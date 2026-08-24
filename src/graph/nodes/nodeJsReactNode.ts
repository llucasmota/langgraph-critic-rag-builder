import type { Runtime } from '@langchain/langgraph';
import type { ILlmService } from '../../services/llmService.ts';
import { RagService } from '../../services/ragService.ts';
import type { GraphState } from '../graph.ts';
import { SpecialistOutputSchema } from './schemas.ts';
import { extractUrls, fetchUrlContent } from '../../services/webContentService.ts';
import { prompts } from '../../config.ts';


export function createNodeReactNode(llmClient: ILlmService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("[Node/React Specialist] Collecting RAG and generating draft...");

    const effectiveCommand = state.optimizedCommand || state.initialCommand;
    const ragService = new RagService();
    let ragContext = await ragService.retrieveContext(effectiveCommand, "node_react");

    if (state.reviewCount > 0 && state.reviewerSearchQuery) {
      console.log(`[Iterative RAG] Searching Pinecone context for: "${state.reviewerSearchQuery}"...`);
      const correctiveContext = await ragService.retrieveContext(state.reviewerSearchQuery, "node_react");
      if (correctiveContext) {
        ragContext = `${ragContext}\n\n[RAG Data (Correction)]: \n${correctiveContext}`;
      }
    }

    // --- Live URL Content Extraction ---
    // Detect any URLs in the user's command and fetch them as live ground-truth data.
    // This prevents the model from hallucinating about topics it may not know from training.
    const urls = extractUrls(effectiveCommand);
    let webData = '';
    if (urls.length > 0) {
      console.log(`[URL Extractor] Found ${urls.length} URL(s) in command. Fetching live content...`);
      const fetchResults = await Promise.allSettled(urls.map(url => fetchUrlContent(url)));
      const fetchedContents: string[] = [];

      fetchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          console.log(`[URL Extractor] ✅ Fetched: ${urls[idx]}`);
          fetchedContents.push(`[Source: ${urls[idx]}]\n${result.value}`);
        } else {
          console.warn(`[URL Extractor] ❌ Could not fetch: ${urls[idx]}`);
        }
      });

      if (fetchedContents.length > 0) {
        webData = fetchedContents.join('\n\n---\n\n');
      }
    }

    const systemPrompt = prompts.nodeJsReact;

    // [WEB_DATA] is placed FIRST in the user prompt to signal highest priority to the model.
    let userPrompt = `Topic:\n"${effectiveCommand}"\n\n`;
    if (webData) {
      userPrompt += `[WEB_DATA] (live content fetched from URLs in the command — treat as absolute ground truth, prioritize over all other sources):\n${webData}\n\n`;
    }
    if (ragContext) userPrompt += `[RAG Data]:\n${ragContext}\n\n`;
    if (state.mcpContext) userPrompt += `[MCP Data]:\n${state.mcpContext}\n\n`;

    if (state.reviewCount > 0 && state.reviewFeedback) {
      const hasSurgical = state.approvedContent || (state.corrections && state.corrections.length > 0);

      if (hasSurgical) {
        // SURGICAL MODE: only fix what the reviewer flagged — preserve everything else.
        userPrompt += `[SURGICAL CORRECTION MODE — Attempt ${state.reviewCount + 1}]:
The reviewer has identified SPECIFIC errors in the previous draft. Your task is to:
1. Preserve ALL of the [APPROVED CONTENT] below VERBATIM — do not alter a single word, punctuation mark, or line break.
2. Apply ONLY the corrections listed in [CORRECTIONS NEEDED] — nothing more.
3. Reassemble the final complete draft by integrating the corrections into the approved content.
4. Do NOT introduce any new claims, examples, or code snippets beyond what is in the approved content + corrections.

[APPROVED CONTENT — COPY VERBATIM, NO CHANGES]:
${state.approvedContent || '(none — the reviewer did not identify any fully correct sections)'}

[CORRECTIONS NEEDED — APPLY THESE SURGICAL FIXES]:
${state.corrections && state.corrections.length > 0
            ? state.corrections.map((c, i) =>
              `Fix #${i + 1}:\n  - ORIGINAL (wrong): "${c.originalText}"\n  - ISSUE: ${c.issue}\n  - REPLACE WITH: ${c.suggestedReplacement || '(delete this claim entirely)'}`
            ).join('\n\n')
            : '(no specific corrections listed — use the general feedback below)'}

[GENERAL FEEDBACK FOR CONTEXT]:
"${state.reviewFeedback}"

`;
      } else {
        // FULL-REWRITE MODE: reviewer provided no surgical data — regenerate from scratch.
        userPrompt += `[REVIEW FEEDBACK — FULL REWRITE NEEDED]:\n"${state.reviewFeedback}"\n\n`;
      }
    }

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SpecialistOutputSchema);

    if (!result.success || !result.data) throw new Error("Failed to generate Node/React draft.");

    return {
      ragContext: ragContext,
      webData: webData || undefined,  // Persist so the Reviewer can validate claims against the source
      technicalDraft: result.data.technicalDraft,
      codeSnippets: result.data.codeSnippets,
    };
  };
}