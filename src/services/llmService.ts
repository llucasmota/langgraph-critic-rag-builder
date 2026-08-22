import type { z } from 'zod/v3';

export type LLMStructuredResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface ILlmService {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>
  ): Promise<LLMStructuredResult<T>>;
}
