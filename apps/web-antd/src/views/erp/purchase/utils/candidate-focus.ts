// Compatibility exports for existing purchase entrypoints.
export {
  CANDIDATE_FOCUS_KEY as PURCHASE_CANDIDATE_FOCUS_KEY,
  CANDIDATE_POPUP_CLASS as PURCHASE_CANDIDATE_POPUP_CLASS,
  appendCandidatePopupClass as appendPurchaseCandidatePopupClass,
  useCandidateSchema as usePurchaseCandidateSchema,
  withCandidateFocus as withPurchaseCandidateFocus,
} from '../../utils/candidate-focus';
