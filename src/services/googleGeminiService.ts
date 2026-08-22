import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { z } from 'zod/v3';
import type { ILlmService, LLMStructuredResult } from './llmService.ts';

export class GoogleGeminiService implements ILlmService {
  private llmClient: ChatGoogleGenerativeAI;

  constructor(modelName: string = process.env.GEMINI_MODEL || 'gemini-1.5-flash', temperature: number = 0.7) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set in environment variables.');
    }

    this.llmClient = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      model: modelName,
      temperature: temperature,
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>
  ): Promise<LLMStructuredResult<T>> {
    try {
      const modelWithStructured = this.llmClient.withStructuredOutput(schema);
      const messages: [string, string][] = [
        ["system", systemPrompt],
        ["user", userPrompt],
      ];

      const result = await modelWithStructured.invoke(messages);

      return {
        success: true,
        data: result as T,
      };
    } catch (error) {
      console.error('🔴 Google Gemini LLM Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
