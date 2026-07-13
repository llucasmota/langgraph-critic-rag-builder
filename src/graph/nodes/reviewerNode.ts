import type { Runtime } from '@langchain/langgraph';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { ReviewerOutputSchema } from './schemas.ts';

export function createReviewerNode(llmClient: OpenRouterService) {
  return async (state: GraphState, runtime?: Runtime): Promise<Partial<GraphState>> => {
    console.log(`[Reviewer] Auditing draft (Attempt ${state.reviewCount + 1}/3)...`);

    if (state.reviewCount >= 3) {
      return { reviewFeedback: "" }; // Force approve
    }

    const systemPrompt = `You are an Expert LinkedIn SSI Strategist. Format technical drafts for max engagement.
Persona: Full Stack Engineer (Mobile/Backend/AI Student). NO "Tech Lead" titles.
Rules: Flawless US English. No AI jargon. Max 2-3 lines per paragraph. Replace code placeholders like [CODE_SNIPPET_1], [CODE_SNIPPET_2], etc. with [IMAGE_CODE_1], [IMAGE_CODE_2], etc. inside the final post text to preserve their respective indices. End with a technical question.

STRICT TECHNICAL FACT-CHECKING & CODE REVIEW:
1. Act as a strict technical fact-checker. Verify all version numbers, API designs, library names, and architectural claims in the draft.
2. If the draft contains fabricated, outdated, or incorrect version claims (e.g. claiming a feature was introduced in Flutter 3.4 when it was in Flutter 3.10), or references non-existent APIs, you MUST reject the post (set isApproved to false) and describe the error clearly in the 'feedback' property so the specialist can correct it.
3. Verify the syntactical correctness of the code snippets. If the code contains invalid placeholders like 'child: ...' or ellipsis that make the code uncompilable, you MUST reject the post and require clean, valid, compile-ready code.
4. Ensure the final post text does not contain markdown code blocks (they should be replaced by [IMAGE_CODE_X]).`;

    const userPrompt = `Review this draft:\n\n${state.technicalDraft}`;
    const result = await llmClient.generateStructured(systemPrompt, userPrompt, ReviewerOutputSchema);

    if (!result.success || !result.data) {
      console.warn(`[Reviewer] Error analyzing draft: ${result.error || 'no data'}. Incrementing reviewCount.`);
      return {
        reviewFeedback: "System error during review, retry.",
        reviewerSearchQuery: "",
        reviewCount: state.reviewCount + 1,
      };
    }

    if (!result.data.isApproved) {
      console.log(`[Reviewer] Rejected. Reason: ${result.data.feedback} | Suggested RAG Query: ${result.data.reviewerSearchQuery}`);
      return {
        reviewFeedback: result.data.feedback,
        reviewerSearchQuery: result.data.reviewerSearchQuery,
        reviewCount: state.reviewCount + 1,
      };
    }

    console.log("[Reviewer] Draft Approved!");
    return {
      reviewFeedback: "", 
      reviewerSearchQuery: "",
      finalPostText: result.data.postText,
      hashtags: result.data.hashtags,
    };
  };
}
