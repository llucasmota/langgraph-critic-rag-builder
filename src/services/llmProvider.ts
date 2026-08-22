import type { z } from 'zod/v3';
import type { ILlmService, LLMStructuredResult } from './llmService.ts';
import { GoogleGeminiService } from './googleGeminiService.ts';
import { OpenRouterService } from './openrouterService.ts';

export class FallbackLlmService implements ILlmService {
  private primary: ILlmService;
  private fallback: ILlmService;

  constructor(primary?: ILlmService, fallback?: ILlmService) {
    this.primary = primary ?? new GoogleGeminiService();
    this.fallback = fallback ?? new OpenRouterService();
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>
  ): Promise<LLMStructuredResult<T>> {
    console.log('[LLM Provider] Trying primary LLM provider (Google Gemini)...');
    const result = await this.primary.generateStructured(systemPrompt, userPrompt, schema);

    if (result.success && result.data) {
      return result;
    }

    console.warn(`[LLM Provider] ⚠️ Primary provider failed (${result.error || 'unknown error'}). Falling back to OpenRouter...`);
    return this.fallback.generateStructured(systemPrompt, userPrompt, schema);
  }
}

export type SupportedLlmProvider = 'google' | 'openrouter' | 'fallback';

export function createLlmService(providerType?: SupportedLlmProvider): ILlmService {
  const selectedProvider = providerType ?? (process.env.LLM_PROVIDER as SupportedLlmProvider) ?? 'fallback';

  console.log(`[LLM Provider] Initializing LLM Service with provider strategy: "${selectedProvider}"`);

  switch (selectedProvider) {
    case 'google':
      return new GoogleGeminiService();
    case 'openrouter':
      return new OpenRouterService();
    case 'fallback':
    default:
      return new FallbackLlmService();
  }
}
