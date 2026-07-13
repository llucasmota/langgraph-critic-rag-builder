#!/bin/bash

echo "🚀 Iniciando a criação da arquitetura do Agentic Workflow..."

# Criação dos diretórios
mkdir -p src/services
mkdir -p src/graph/nodes
mkdir -p tests
mkdir -p output

echo "📂 Diretórios criados com sucesso."

# ---------------------------------------------------------
# 1. SCHEMAS (src/graph/nodes/schemas.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/schemas.ts
import { z } from "zod/v3";

export const OrchestratorOutputSchema = z.object({
  reasoning: z.string().describe("A brief explanation of why this specific niche was chosen based on the user's initial command."),
  niche: z.enum(["flutter_dart", "node_react", "ai_engineering"]).describe("The exact technical area the command belongs to."),
});

export const SpecialistOutputSchema = z.object({
  technicalDraft: z.string().describe("The deep, pragmatic technical text in US English. Insert placeholders like [CODE_SNIPPET_1] where code should appear."),
  codeSnippets: z.array(z.string()).describe("An array containing only the raw, compilable code snippets."),
});

export const ReviewerOutputSchema = z.object({
  isApproved: z.boolean().describe("True if the post meets all SSI criteria and technical depth. False if it needs rework."),
  feedback: z.string().optional().describe("If isApproved is false, provide specific instructions for the specialist. If true, leave empty."),
  postText: z.string().optional().describe("If isApproved is true, provide the final optimized post text in US English."),
  hashtags: z.array(z.string()).optional().describe("If isApproved is true, provide 3 to 5 highly relevant hashtags."),
});
EOF

# ---------------------------------------------------------
# 2. EDGE CONDITIONS (src/graph/nodes/edgeConditions.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/edgeConditions.ts
import type { GraphState } from '../graph.ts';

export const routeToSpecialist = (state: GraphState): string => {
  if (!state.niche) return 'nodeReactSpecialist';

  const routes: Record<string, string> = {
    flutter_dart: 'flutterSpecialist',
    node_react: 'nodeReactSpecialist',
    ai_engineering: 'aiSpecialist',
  };

  return routes[state.niche] || 'nodeReactSpecialist';
};

export const routeAfterReview = (state: GraphState): string => {
  if (!state.reviewFeedback || state.reviewFeedback.trim() === "") {
    return 'imageExtractor';
  }
  if (state.reviewCount >= 3) {
    console.warn("⚠️ Limite de revisões atingido. Avançando para extração.");
    return 'imageExtractor';
  }
  return routeToSpecialist(state);
};
EOF

# ---------------------------------------------------------
# 3. ORCHESTRATOR NODE (src/graph/nodes/orchestratorNode.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/orchestratorNode.ts
import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { OrchestratorOutputSchema } from './schemas.ts';

export function createOrchestratorNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`\n[Orchestrator] Analisando: "${state.initialCommand}"`);

    const systemPrompt = `You are a Technical Dispatcher for an automated LinkedIn content creation system. Classify the user's command into: "flutter_dart", "node_react", or "ai_engineering". Focus on the core architectural intent.`;
    const userPrompt = `Classify this request:\n\n"${state.initialCommand}"`;

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, OrchestratorOutputSchema);

    if (!result.success || !result.data) {
      console.warn(`[Orchestrator] Fallback ativado. Erro: ${result.error}`);
      return { niche: "node_react" }; 
    }

    console.log(`[Orchestrator] Nicho: ${result.data.niche} | Motivo: ${result.data.reasoning}`);
    return { niche: result.data.niche };
  };
}
EOF

# ---------------------------------------------------------
# 4. FLUTTER NODE (src/graph/nodes/flutterNode.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/flutterNode.ts
import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { RagService } from '../../services/ragService.ts';
import type { GraphState } from '../graph.ts';
import { SpecialistOutputSchema } from './schemas.ts';

export function createFlutterNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("[Flutter Specialist] Coletando RAG e gerando rascunho...");

    const ragService = new RagService();
    const ragContext = await ragService.retrieveContext(state.initialCommand, "flutter_dart");

    const systemPrompt = `You are a Senior Mobile & Full Stack Software Engineer specializing in Flutter and Dart. 
Persona: Pragmatic executor, over 6 years experience. PROHIBITED: Never use "Tech Lead" or management titles.
Output: Professional US English. Replace code with [CODE_SNIPPET_X] in the text, and put raw code in the array.`;

    let userPrompt = `Topic:\n"${state.initialCommand}"\n\n`;
    if (ragContext) userPrompt += `[RAG Data]:\n${ragContext}\n\n`;
    if (state.mcpContext) userPrompt += `[MCP Data]:\n${state.mcpContext}\n\n`;
    
    if (state.reviewCount > 0 && state.reviewFeedback) {
      userPrompt += `[REVIEW FEEDBACK - FIX THIS]:\n"${state.reviewFeedback}"\n\n`;
    }

    const result = await llmClient.generateStructured(systemPrompt, userPrompt, SpecialistOutputSchema);
    
    if (!result.success || !result.data) throw new Error("Failed to generate draft.");
    
    return {
      ragContext: ragContext,
      technicalDraft: result.data.technicalDraft,
      codeSnippets: result.data.codeSnippets,
    };
  };
}
EOF

# ---------------------------------------------------------
# 5. REVIEWER NODE (src/graph/nodes/reviewerNode.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/reviewerNode.ts
import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { ReviewerOutputSchema } from './schemas.ts';

export function createReviewerNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`[Reviewer] Auditando rascunho (Tentativa ${state.reviewCount + 1}/3)...`);

    if (state.reviewCount >= 3) {
      return { reviewFeedback: "" }; // Aprova à força
    }

    const systemPrompt = `You are an Expert LinkedIn SSI Strategist. Format technical drafts for max engagement.
Persona: Full Stack Engineer (Mobile/Backend/AI Student). NO "Tech Lead" titles.
Rules: Flawless US English. No AI jargon. Max 2-3 lines per paragraph. Replace code with [IMAGE_CODE_HERE]. End with a technical question.`;

    const userPrompt = `Review this draft:\n\n${state.technicalDraft}`;
    const result = await llmClient.generateStructured(systemPrompt, userPrompt, ReviewerOutputSchema);

    if (!result.success || !result.data) return { reviewFeedback: "System error, retry." };

    if (!result.data.isApproved) {
      console.log(`[Reviewer] Reprovado. Motivo: ${result.data.feedback}`);
      return {
        reviewFeedback: result.data.feedback,
        reviewCount: state.reviewCount + 1,
      };
    }

    console.log("[Reviewer] Rascunho Aprovado!");
    return {
      reviewFeedback: "", 
      finalPostText: result.data.postText,
      hashtags: result.data.hashtags,
    };
  };
}
EOF

# ---------------------------------------------------------
# 6. IMAGE EXTRACTOR NODE (src/graph/nodes/imageExtractorNode.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/nodes/imageExtractorNode.ts
import fs from 'fs/promises';
import path from 'path';
import type { Runtime } from '@langchain/langgraph';
import type { GraphState } from '../graph.ts';

export function createImageExtractorNode() {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log("\n[Image Extractor] Preparando pacote final...");
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    if (state.finalPostText) {
      const hashtagsStr = state.hashtags ? `\n\n${state.hashtags.join(' ')}` : '';
      const textPath = path.join(outputDir, 'linkedin_post.txt');
      await fs.writeFile(textPath, `${state.finalPostText}${hashtagsStr}`, 'utf-8');
      console.log(`[+] Texto salvo: ${textPath}`);
    }

    if (state.codeSnippets && state.codeSnippets.length > 0) {
      for (let i = 0; i < state.codeSnippets.length; i++) {
        try {
          const response = await fetch('https://carbonara.solopov.dev/api/cook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: state.codeSnippets[i],
              backgroundColor: "rgba(171, 184, 195, 1)",
              theme: "dracula", windowTheme: "mac", dropShadow: true,
              paddingVertical: "56px", paddingHorizontal: "56px"
            })
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const imgPath = path.join(outputDir, `snippet_${i + 1}.png`);
            await fs.writeFile(imgPath, Buffer.from(buffer));
            console.log(`[+] Código salvo: ${imgPath}`);
          }
        } catch (e) {
           console.error(`[-] Erro ao gerar imagem ${i+1}`, e);
        }
      }
    }
    console.log("\n✅ Processo finalizado! Acesse a pasta /output.\n");
    return { reviewCount: 0 };
  };
}
EOF

# ---------------------------------------------------------
# 7. THE GRAPH BUILDER (src/graph/graph.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/graph/graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod/v3";
import { OpenRouterService } from '../services/openrouterService.ts';

import { createOrchestratorNode } from './nodes/orchestratorNode.ts';
import { createFlutterNode } from './nodes/flutterNode.ts';
import { createReviewerNode } from './nodes/reviewerNode.ts';
import { createImageExtractorNode } from './nodes/imageExtractorNode.ts';
import { routeToSpecialist, routeAfterReview } from './nodes/edgeConditions.ts';

export const PostStateAnnotation = z.object({
  initialCommand: z.string(),
  niche: z.enum(["flutter_dart", "node_react", "ai_engineering"]).optional(),
  ragContext: z.string().optional(),
  mcpContext: z.string().optional(),
  technicalDraft: z.string().optional(),
  codeSnippets: z.array(z.string()).optional(),
  reviewFeedback: z.string().optional(),
  finalPostText: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  reviewCount: z.number().default(0),
});

export type GraphState = z.infer<typeof PostStateAnnotation>;

export function buildPostGraph(llmClient: OpenRouterService) {
  const graph = new StateGraph(PostStateAnnotation)
    .addNode('orchestrator', createOrchestratorNode(llmClient))
    .addNode('flutterSpecialist', createFlutterNode(llmClient))
    .addNode('reviewer', createReviewerNode(llmClient))
    .addNode('imageExtractor', createImageExtractorNode())

    .addEdge(START, 'orchestrator')
    .addConditionalEdges('orchestrator', routeToSpecialist, {
      flutterSpecialist: 'flutterSpecialist',
      nodeReactSpecialist: 'nodeReactSpecialist',
      aiSpecialist: 'aiSpecialist',
    })
    
    .addEdge('flutterSpecialist', 'reviewer')

    .addConditionalEdges('reviewer', routeAfterReview, {
      imageExtractor: 'imageExtractor',
      flutterSpecialist: 'flutterSpecialist',
      nodeReactSpecialist: 'nodeReactSpecialist',
      aiSpecialist: 'aiSpecialist',
    })
    .addEdge('imageExtractor', END);

  return graph.compile();
}
EOF

# ---------------------------------------------------------
# 8. RAG SERVICE (src/services/ragService.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/services/ragService.ts
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export class RagService {
  private vectorStore: PineconeStore | null = null;

  async init() {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY!,
      modelName: "text-embedding-004", 
    });

    this.vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: "linkedin_knowledge_base", 
    });
  }

  async retrieveContext(query: string, filterNiche?: string): Promise<string> {
    if (!this.vectorStore) await this.init();
    
    console.log(`[RAG] Buscando contexto no Pinecone para: "${query}"...`);
    const filter = filterNiche ? { niche: filterNiche } : undefined;
    const results = await this.vectorStore!.similaritySearch(query, 4, filter);

    if (results.length === 0) return "";
    return results.map(doc => `[Source: ${doc.metadata?.source || 'Unknown'}]\n${doc.pageContent}`).join('\n\n');
  }
}
EOF

# ---------------------------------------------------------
# 9. ENTRY POINT (src/index.ts)
# ---------------------------------------------------------
cat << 'EOF' > src/index.ts
import { OpenRouterService } from './services/openrouterService.ts';
import { buildPostGraph } from './graph/graph.ts';

async function main() {
  const args = process.argv.slice(2);
  const command = args.length > 0 ? args.join(" ") : "Explain dependency injection in Flutter using Widgetbook";

  const llmClient = new OpenRouterService();
  const graph = buildPostGraph(llmClient);

  console.log(`🚀 Iniciando Agentic Workflow para o LinkedIn...`);
  console.log(`Comando recebido: "${command}"\n`);

  await graph.invoke({
    initialCommand: command,
    reviewCount: 0
  });
}

main().catch(console.error);
EOF

# ---------------------------------------------------------
# 10. TESTES (tests/edgeConditions.test.ts)
# ---------------------------------------------------------
cat << 'EOF' > tests/edgeConditions.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { routeToSpecialist, routeAfterReview } from '../src/graph/nodes/edgeConditions.ts';
import type { GraphState } from '../src/graph/graph.ts';

test('Edge Conditions - Orquestrador: routeToSpecialist', async (t) => {
  await t.test('Deve rotear para flutterSpecialist', () => {
    const state = { niche: 'flutter_dart' } as GraphState;
    assert.strictEqual(routeToSpecialist(state), 'flutterSpecialist');
  });

  await t.test('Deve rotear para aiSpecialist', () => {
    const state = { niche: 'ai_engineering' } as GraphState;
    assert.strictEqual(routeToSpecialist(state), 'aiSpecialist');
  });
});

test('Edge Conditions - Guardrail do Revisor: routeAfterReview', async (t) => {
  await t.test('Deve avançar se aprovado', () => {
    const state = { reviewFeedback: '', reviewCount: 1, niche: 'node_react' } as GraphState;
    assert.strictEqual(routeAfterReview(state), 'imageExtractor');
  });

  await t.test('Deve forçar saída no limite de revisões', () => {
    const state = { reviewFeedback: 'Still bad', reviewCount: 3, niche: 'flutter_dart' } as GraphState;
    assert.strictEqual(routeAfterReview(state), 'imageExtractor');
  });
});
EOF

# ---------------------------------------------------------
# 11. PACKAGE.JSON (Raiz do projeto)
# ---------------------------------------------------------
cat << 'EOF' > package.json
{
  "name": "linkedin-agentic-workflow",
  "version": "1.0.0",
  "description": "Agentic Workflow para posts técnicos no LinkedIn",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "start": "npx tsx src/index.ts",
    "test": "node --env-file .env --test tests/**/*.test.ts",
    "test:watch": "node --env-file .env --test --watch tests/**/*.test.ts"
  },
  "keywords": [
    "langchain",
    "langgraph",
    "agentic-workflow",
    "openrouter",
    "pinecone"
  ],
  "author": "Lucas Mota",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.19.7",
    "tsx": "^4.16.2",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=24.10.0"
  },
  "dependencies": {
    "@langchain/community": "^1.1.14",
    "@langchain/core": "^1.2.1",
    "@langchain/google-genai": "^0.0.17",
    "@langchain/langgraph": "^1.4.7",
    "@langchain/pinecone": "^0.0.7",
    "@openrouter/sdk": "^0.8.0",
    "@pinecone-database/pinecone": "^2.2.2",
    "langchain": "^1.2.21",
    "zod": "^3.23.8"
  }
}
EOF

echo "✅ package.json gerado com sucesso!"

echo "✅ Todos os arquivos foram gerados na estrutura correta."
echo "Certifique-se de colar a sua classe 'openrouterService.ts' dentro da pasta 'src/services/' antes de rodar o projeto!"