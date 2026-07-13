import { z } from "zod/v3";

export const OrchestratorOutputSchema = z.object({
  reasoning: z.string().describe("A brief explanation of why this specific niche was chosen based on the user's initial command."),
  niche: z.enum(["flutter_dart", "node_react", "ai_engineering", "out_of_scope"]).describe("The exact technical area the command belongs to, or 'out_of_scope' if it is unrelated to these areas."),
  suggestedFolderSlug: z.string().describe("A very short, succinct folder name (slug) in lowercase with hyphens, representing the topic in max 20 characters. E.g., 'flutter-mediaquery' or 'node-di' or 'ai-agents'."),
});

export const SpecialistOutputSchema = z.object({
  technicalDraft: z.string().describe("The deep, pragmatic technical text in US English. Insert placeholders like [CODE_SNIPPET_1] where code should appear."),
  codeSnippets: z.array(z.string()).describe("An array containing only the raw, compilable code snippets."),
});

export const ReviewerOutputSchema = z.object({
  isApproved: z.boolean().describe("True if the post meets all SSI criteria and technical depth. False if it needs rework."),
  feedback: z.string().describe("If isApproved is false, provide specific instructions for the specialist. If true, set to an empty string."),
  reviewerSearchQuery: z.string().describe("If isApproved is false, generate a targeted 1-sentence search query to find correct technical facts in the database (Pinecone) related to the issues. If true, set to an empty string."),
  postText: z.string().describe("If isApproved is true, provide the final optimized post text in US English. If false, set to an empty string."),
  hashtags: z.array(z.string()).describe("If isApproved is true, provide 3 to 5 highly relevant hashtags. If false, set to an empty array."),
});
