import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { RagService } from '../../services/ragService.ts';
import type { GraphState } from '../graph.ts';
import { SpecialistOutputSchema } from './schemas.ts';

export function createAiNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("[AI Engineering Specialist] Collecting RAG and generating draft...");

    const ragService = new RagService();
    let ragContext = await ragService.retrieveContext(state.initialCommand, "ai_engineering");

    if (state.reviewCount > 0 && state.reviewerSearchQuery) {
      console.log(`[Iterative RAG] Searching Pinecone context for: "${state.reviewerSearchQuery}"...`);
      const correctiveContext = await ragService.retrieveContext(state.reviewerSearchQuery, "ai_engineering");
      if (correctiveContext) {
        ragContext = `${ragContext}\n\n[RAG Data (Correction)]: \n${correctiveContext}`;
      }
    }

    const systemPrompt = `You are an Applied AI Engineer and Full Stack Developer. You specialize in integrating Machine Learning, LLMs, RAG architectures, and Agentic Workflows (like LangGraph) into real-world software products.
Persona: A hands-on engineer and postgraduate student in Applied AI. You treat AI not as magic, but as software engineering grounded in algorithms and statistics.
PROHIBITED: Never use "Tech Lead", "Manager", or alarmist futuristic AI jargon.

Task: Write a deep, technical draft in professional US English. Focus on implementation and architecture.
Code Separation: DO NOT output raw code blocks in the text. Replace code with [CODE_SNIPPET_X] in the text, and put the raw Python or TS code in the 'codeSnippets' array.

STRICT GROUNDING & ANTI-HALLUCINATION:
1. Ground your knowledge in the provided [RAG Data]. Do not make up versions of packages, libraries, or frameworks.
2. If you refer to a specific version of a library/tool (e.g. LangGraph 0.1, Pinecone 3.0), you must be absolutely certain that is the correct version. If you are unsure, do not state a specific version number; instead, use safe general phrasing (e.g., 'In recent versions of LangGraph...').
3. Never invent APIs, methods, or parameters.
4. All code snippets in 'codeSnippets' must be complete, syntactically valid Python/TypeScript code. Do not use ellipses (...) or placeholders like '# ... integrate logic' inside code blocks unless it is inside a comments block that explains the context. The code must be clean, readable, and directly copy-pasteable.`;

    let userPrompt = `Topic:\n"${state.initialCommand}"\n\n`;
    if (ragContext) userPrompt += `[RAG Data]:\n${ragContext}\n\n`;
    if (state.mcpContext) userPrompt += `[MCP Data]:\n${state.mcpContext}\n\n`;

    if (state.reviewCount > 0 && state.reviewFeedback) {
      userPrompt += `[REVIEW FEEDBACK - FIX THIS]:\n"${state.reviewFeedback}"\n\n`;
    }

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SpecialistOutputSchema);

    if (!result.success || !result.data) throw new Error("Failed to generate AI Engineering draft.");

    return {
      ragContext: ragContext,
      technicalDraft: result.data.technicalDraft,
      codeSnippets: result.data.codeSnippets,
    };
  };
}