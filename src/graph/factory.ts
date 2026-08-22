import { createLlmService } from '../services/llmProvider.ts';
import { buildPostGraph } from './graph.ts';
// import { createMemoryService } from '../services/memoryServices.ts';
// import { PreferencesService } from '../services/preferencesService.ts';

export async function buildGraph(dbPath: string = './preferences.db') {
  const llmClient = createLlmService();

  // const memoryService = await createMemoryService()
  // const preferencesService = new PreferencesService(dbPath)

  const graph = buildPostGraph(
    llmClient,
    // preferencesService,
    // memoryService
  );

  return {
    graph,
    // memoryService: {
    //   store: {
    //     search: (arg1: any, arg2: any) => Promise.resolve([])
    //   }
    // },
  };
}

export const graph = async () => buildGraph();
export default graph;
