import type { GraphState } from '../graph.ts';

export const routeToSpecialist = (state: GraphState): string => {
  if (!state.niche) return 'nodeReactSpecialist';

  const routes: Record<string, string> = {
    flutter_dart: 'flutterSpecialist',
    node_react: 'nodeReactSpecialist',
    ai_engineering: 'aiSpecialist',
    out_of_scope: 'imageExtractor',
  };

  return routes[state.niche] || 'nodeReactSpecialist';
};

export const routeAfterReview = (state: GraphState): string => {
  if (!state.reviewFeedback || state.reviewFeedback.trim() === "") {
    return 'imageExtractor';
  }
  if (state.reviewCount >= 3) {
    console.warn("⚠️ Review limit reached. Proceeding to extraction.");
    return 'imageExtractor';
  }
  return routeToSpecialist(state);
};
