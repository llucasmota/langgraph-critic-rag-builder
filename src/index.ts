
import { buildPostGraph } from './graph/graph.ts';
import { OpenRouterService } from './services/openrouterService.ts';

async function main() {
  const args = process.argv.slice(2);
  const command = args.length > 0 ? args.join(" ") : "Explain dependency injection in Flutter using Widgetbook";

  const llmClient = new OpenRouterService();
  const graph = buildPostGraph(llmClient);

  console.log(`🚀 Starting Agentic Workflow for LinkedIn...`);
  console.log(`Received command: "${command}"\n`);

  await graph.invoke({
    initialCommand: command,
    reviewCount: 0
  });
}

main().catch(console.error);
