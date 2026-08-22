import { readFileSync } from "node:fs";

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
  aiEngineer: readFileSync('./prompts/v1/aiEngineer.txt', 'utf-8'),
  nodeJsReact: readFileSync('./prompts/v1/nodeJsReact.txt', 'utf-8'),
  orchestrator: readFileSync('./prompts/v1/orchestrator.txt', 'utf-8'),
  promptOptimizer: readFileSync('./prompts/v1/promptOptimizer.txt', 'utf-8'),
  reviewer: readFileSync('./prompts/v1/reviewer.txt', 'utf-8'),
}

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
