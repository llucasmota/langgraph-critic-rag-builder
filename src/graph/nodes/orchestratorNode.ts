import type { Runtime } from '@langchain/langgraph';
import type { ILlmService } from '../../services/llmService.ts';
import type { GraphState } from '../graph.ts';
import { OrchestratorOutputSchema } from './schemas.ts';
import { prompts } from '../../config.ts';

export function createOrchestratorNode(llmClient: ILlmService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    const effectiveCommand = state.optimizedCommand || state.initialCommand;
    console.log(`\n[Orchestrator] Analyzing: "${effectiveCommand}"`);

    const systemPrompt = prompts.orchestrator;
    const userPrompt = `Classify this request:\n\n"${effectiveCommand}"`;

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, OrchestratorOutputSchema);

    if (!result.success || !result.data) {
      console.warn(`[Orchestrator] Fallback activated. Error: ${result.error}`);
      return { niche: "node_react", suggestedFolderSlug: "node-react" };
    }

    console.log(`[Orchestrator] Niche: ${result.data.niche} | Suggested Slug: ${result.data.suggestedFolderSlug} | Reason: ${result.data.reasoning}`);
    return {
      niche: result.data.niche,
      suggestedFolderSlug: result.data.suggestedFolderSlug,
    };
  };
}
