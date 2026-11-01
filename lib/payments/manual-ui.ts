export function canUploadManualProof(input: {
  viewLoaded: boolean;
  bankConfigured: boolean;
  busy: boolean;
  paid: boolean;
  pendingReview: boolean;
  reviewRequired: boolean;
  gatewayActive: boolean;
}) {
  return (
    input.viewLoaded &&
    input.bankConfigured &&
    !input.busy &&
    !input.paid &&
    !input.pendingReview &&
    !input.reviewRequired &&
    !input.gatewayActive
  );
}
