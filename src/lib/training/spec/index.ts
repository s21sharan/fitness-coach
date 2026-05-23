export * from "./schema";
export { classifyMovementPatterns, isLowerBodyExercise } from "./movement";
export { checkSpecConsistency, isValidSpecPayload, type SpecConsistencyResult } from "./check-spec";
export { checkPlanAgainstSpec, hasBlockers, type SpecViolation } from "./check-plan";
export { renderSpecForPrompt, renderViolationsForRepair } from "./render";
export { authorSpecPayload } from "./author";
export { reviewSpecChange, specReviewSchema, type SpecReview } from "./review";
export { gatherSpecAuthorContext, renderAuthorContext, type SpecAuthorContext } from "./context";
export {
  getActiveSpec,
  ensureActiveSpec,
  mutateSpec,
  specToPayload,
  type MutateResult,
} from "./store";
