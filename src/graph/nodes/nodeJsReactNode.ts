import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { RagService } from '../../services/ragService.ts';
import type { GraphState } from '../graph.ts';
import { SpecialistOutputSchema } from './schemas.ts';

export function createNodeReactNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("[Node/React Specialist] Collecting RAG and generating draft...");

    const ragService = new RagService();
    let ragContext = await ragService.retrieveContext(state.initialCommand, "node_react");

    if (state.reviewCount > 0 && state.reviewerSearchQuery) {
      console.log(`[Iterative RAG] Searching Pinecone context for: "${state.reviewerSearchQuery}"...`);
      const correctiveContext = await ragService.retrieveContext(state.reviewerSearchQuery, "node_react");
      if (correctiveContext) {
        ragContext = `${ragContext}\n\n[RAG Data (Correction)]: \n${correctiveContext}`;
      }
    }

    const systemPrompt = `You are a Senior Full Stack Software Engineer specializing in the JavaScript and TypeScript ecosystem (Node.js, React, Next.js).
Persona: Pragmatic, highly technical executor with over 6 years of experience. You care about strict typing, automated testing, clean architecture, and how things work under the hood (e.g., the Node Event Loop, React render cycles).
PROHIBITED: Never use "Tech Lead" or management titles. Avoid hype words.

Task: Write a deep, technical draft in professional US English.
Code Separation: DO NOT output raw code blocks in the text. Replace code with [CODE_SNIPPET_X] in the text, and put the raw, compilable TS/JS code in the 'codeSnippets' array.

STRICT GROUNDING & ANTI-HALLUCINATION:
1. Ground your knowledge in the provided [RAG Data]. Do not make up versions of packages, libraries, or frameworks.
2. If you refer to a specific version of a library/tool (e.g. React 19, Next.js 15), you must be absolutely certain that is the correct version. If you are unsure, do not state a specific version number; instead, use safe general phrasing (e.g., 'In recent versions of React...').
3. Never invent APIs, methods, or parameters.
4. All code snippets in 'codeSnippets' must be complete, syntactically valid TypeScript/JavaScript code. Do not use ellipses (...) or placeholders like '// ... perform logic' inside code blocks unless it is inside a comments block that explains the context. The code must be clean, readable, and directly copy-pasteable.`;

    let userPrompt = `Topic:\n"${state.initialCommand}"\n\n`;
    if (ragContext) userPrompt += `[RAG Data]:\n${ragContext}\n\n`;
    if (state.mcpContext) userPrompt += `[MCP Data]:\n${state.mcpContext}\n\n`;

    if (state.reviewCount > 0 && state.reviewFeedback) {
      userPrompt += `[REVIEW FEEDBACK - FIX THIS]:\n"${state.reviewFeedback}"\n\n`;
    }

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SpecialistOutputSchema);

    if (!result.success || !result.data) throw new Error("Failed to generate Node/React draft.");

    return {
      ragContext: ragContext,
      technicalDraft: result.data.technicalDraft,
      codeSnippets: result.data.codeSnippets,
    };
  };
}