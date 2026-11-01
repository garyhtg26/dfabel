import test from "node:test";
import assert from "node:assert/strict";
import { canUploadManualProof } from "../lib/payments/manual-ui";

test("customers can upload a draft receipt before actual weight and shipping are final", () => {
  assert.equal(
    canUploadManualProof({
      viewLoaded: true,
      bankConfigured: true,
      busy: false,
      paid: false,
      pendingReview: false,
      reviewRequired: false,
      gatewayActive: false,
    }),
    true,
  );
});
