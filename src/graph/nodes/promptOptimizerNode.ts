import type { Runtime } from '@langchain/langgraph';
import type { ILlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import { PromptOptimizerOutputSchema } from './schemas.ts';
import { prompts } from '../../config.ts';

export function createPromptOptimizerNode(llmClient: ILlmService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`\n[Prompt Optimizer] Auditing & Refining prompt...`);

    const systemPrompt = prompts.promptOptimizer;

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
