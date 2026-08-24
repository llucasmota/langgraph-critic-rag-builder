import { readFileSync } from "node:fs";
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };

  models: string[];
  temperature: number;

  memory: {
    dbUri: string;
  };
};

console.assert(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY is not set in environment variables');



export const prompts = {
  aiEngineer: readFileSync(join(__dirname, 'prompts/v1/aiEngineer.txt'), 'utf-8'),
  nodeJsReact: readFileSync(join(__dirname, 'prompts/v1/nodeJsReact.txt'), 'utf-8'),
  orchestrator: readFileSync(join(__dirname, 'prompts/v1/orchestrator.txt'), 'utf-8'),
  promptOptimizer: readFileSync(join(__dirname, 'prompts/v1/promptOptimizer.txt'), 'utf-8'),
  reviewer: readFileSync(join(__dirname, 'prompts/v1/reviewer.txt'), 'utf-8'),
  flutterNode: readFileSync(join(__dirname, 'prompts/v1/flutterNode.txt'), 'utf-8'),
};

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: '',
  xTitle: 'IA Devs - Prompt Chaining Article Generator',
  models: [
    'qwen/qwen3-coder-next',
    // https://openrouter.ai/models?fmt=cards&max_price=0&order=throughput-high-to-low&supported_parameters=structured_outputs%2Cresponse_format
    // 'upstage/solar-pro-3:free',
    // 'gpt-oss-120b:free',
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: 0.7,
  memory: {
    dbUri: 'postgresql://postgres:mysecretpassword@localhost:5432/song_recommender',
  }
};
