import type { Runtime } from '@langchain/langgraph';
import type { ILlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import { ReviewerOutputSchema } from './schemas.ts';
import { prompts } from '../../config.ts';

export function createReviewerNode(llmClient: ILlmService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`[Reviewer] Auditing draft (Attempt ${state.reviewCount + 1}/3)...`);

    if (state.reviewCount >= 5) {
      // If there is still no finalPostText after 3 rounds, this is a critical failure.
      // Signal it explicitly so the image extractor does not silently save bad content.
      if (!state.technicalDraft || state.technicalDraft.trim().length < 100) {
        return { reviewFeedback: 'CRITICAL_FAILURE' };
      }
      // Review limit reached but there IS a draft — let it through with a warning.
      return { reviewFeedback: '' };
    }

    const systemPrompt = prompts.reviewer;

    const today = new Date().toISOString().split('T')[0]; // e.g. "2026-07-14"
    const effectiveCommand = state.optimizedCommand || state.initialCommand;
    let userPrompt = `CONTEXT FOR THIS REVIEW:
Today's date is ${today}. The specialist may have written about topics that are more recent than your training data cutoff. This is expected and valid.
If [WEB_DATA] is provided below and confirms the facts in the draft, treat those facts as VERIFIED — do not reject them solely because they postdate your knowledge cutoff.
Your job is to check that the draft accurately reflects what [WEB_DATA] says, not to question whether [WEB_DATA] itself is real.

---
USER COMMAND & CONSTRAINTS:
"""
${effectiveCommand}
"""

---
DRAFT TO REVIEW:
${state.technicalDraft}`;

    if (state.codeSnippets && state.codeSnippets.length > 0) {
      userPrompt += `\n\n---
CODE SNIPPETS PRODUCED BY SPECIALIST (check syntax & user language compliance):
${state.codeSnippets.map((s, i) => `[Snippet ${i + 1}]:\n${s}`).join('\n\n')}`;
    }

    if (state.webData) {
      userPrompt += `\n\n---
[WEB_DATA] (live source fetched from the user's URL — use as ground truth for fact-checking):\n${state.webData.substring(0, 6_000)}`;
    }
    const result = await llmClient.generateStructured(systemPrompt, userPrompt, ReviewerOutputSchema);

    if (!result.success || !result.data) {
      console.warn(`[Reviewer] Error analyzing draft: ${result.error || 'no data'}. Incrementing reviewCount.`);
      return {
        reviewFeedback: "System error during review, retry.",
        reviewerSearchQuery: "",
        reviewCount: state.reviewCount + 1,
      };
    }

    if (!result.data.isApproved) {
      const hasSurgicalData = result.data.approvedContent || (result.data.corrections && result.data.corrections.length > 0);
      console.log(`[Reviewer] Rejected. Reason: ${result.data.feedback} | Surgical corrections: ${result.data.corrections?.length ?? 0} | Approved content preserved: ${result.data.approvedContent ? 'yes' : 'no'} | Suggested RAG Query: ${result.data.reviewerSearchQuery}`);
      return {
        reviewFeedback: result.data.feedback,
        reviewerSearchQuery: result.data.reviewerSearchQuery,
        approvedContent: result.data.approvedContent || undefined,
        corrections: result.data.corrections && result.data.corrections.length > 0 ? result.data.corrections : undefined,
        reviewCount: state.reviewCount + 1,
      };
    }

    console.log("[Reviewer] Draft Approved!");
    return {
      reviewFeedback: "",
      reviewerSearchQuery: "",
      finalPostText: result.data.postText,
      hashtags: result.data.hashtags,
    };
  };
}
