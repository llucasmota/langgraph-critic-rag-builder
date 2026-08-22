import type { Runtime } from '@langchain/langgraph';
import type { ILlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import { PromptOptimizerOutputSchema } from './schemas.ts';

export function createPromptOptimizerNode(llmClient: ILlmService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`\n[Prompt Optimizer] Auditing & Refining prompt...`);

    const systemPrompt = `You are an expert AI Prompt Engineer and Pre-flight Validator for an automated technical LinkedIn post generation pipeline.

Your objective is to inspect the raw user command and produce an optimized, unambiguous, structured prompt for downstream specialists.

RULES & OPTIMIZATIONS TO APPLY:
1. Contradiction Resolution:
   - If the topic is Flutter/Dart, strictly eliminate contradictory references to other languages in formatting rules (e.g. "TypeScript snippet", "Python snippet") and specify Dart.
   - If the topic is Node.js/React, enforce TypeScript/JavaScript.
   - Ensure the code language rule matches the overall framework/topic.
2. Deduplication & Cleanup:
   - Fix merged/glued text (e.g. "decoupled?Choose your own...").
   - Eliminate duplicated priorities or fragmented bullet points.
   - Convert negative prohibitions ("Do not write Python") into explicit positive requirements ("Language: Strictly Dart").
3. Anti-Hallucination Guardrails:
   - Ensure the prompt demands truthfulness to provided URLs/sources, prohibiting synthetic or imaginary APIs.
4. Preservation of Critical Metadata:
   - Keep all provided URLs/Resources verbatim.
   - Keep the target audience, length, and pragmatic tone constraints.
   - Keep and clarify placeholder usage like [CODE_SNIPPET_1] if code examples are expected.
5. Non-Technical / Out of Scope Prompts:
   - If the input is casual chit-chat, a joke, or a non-technical request (e.g. cooking recipe), leave it intact without forcing technical templates.`;

    const userPrompt = `Audit, resolve contradictions, and optimize this user command:\n\n"""\n${state.initialCommand}\n"""`;

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, PromptOptimizerOutputSchema);

    if (!result.success || !result.data) {
      console.warn(`[Prompt Optimizer] Fallback: using original command. (Error: ${result.error})`);
      return {
        optimizedCommand: state.initialCommand,
        promptOptimizationSummary: 'Fallback to original command.',
      };
    }

    if (result.data.detectedIssues && result.data.detectedIssues.length > 0) {
      console.log(`[Prompt Optimizer] 🛠️ Fixed ${result.data.detectedIssues.length} prompt issue(s):`);
      result.data.detectedIssues.forEach((issue) => console.log(`  - ⚠️ ${issue}`));
      console.log(`[Prompt Optimizer] ✅ ${result.data.summary}`);
    } else {
      console.log(`[Prompt Optimizer] ✅ Prompt is clean and ready.`);
    }

    return {
      optimizedCommand: result.data.optimizedCommand,
      promptOptimizationSummary: result.data.summary,
    };
  };
}
