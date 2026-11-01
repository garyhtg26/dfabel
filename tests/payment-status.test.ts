import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaymentStatus from "../components/payment-status";
import type { ManualPaymentSummary } from "../lib/payments/manual-types";

const manual: ManualPaymentSummary = {
  method: "bank_transfer",
  status: "awaiting_review",
  amount: 40000,
  hasProof: true,
  proofVersion: "test-proof",
};

test("submitted transfer proof is visibly pending and never labelled paid", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentStatus, {
      paid: false,
      manualPayment: manual,
      compact: false,
    }),
  );
  assert.match(html, /Perlu konfirmasi/);
  assert.match(html, /bg-amber-/);
  assert.doesNotMatch(html, /Lunas/);
  assert.match(html, /role="status"/);
});

test("confirmed manual transfer has a distinct paid state", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentStatus, {
      paid: true,
      manualPayment: { ...manual, status: "paid" },
      compact: false,
    }),
  );
  assert.match(html, /Lunas/);
  assert.match(html, /bg-emerald-/);
  assert.doesNotMatch(html, /Perlu konfirmasi/);
});

test("rejection and reconciliation exceptions stay distinct from a successful payment", () => {
  const rejected = renderToStaticMarkup(
    createElement(PaymentStatus, {
      paid: false,
      manualPayment: {
        ...manual,
        status: "rejected",
        rejectionReason: "<script>blocked</script>",
      },
      compact: false,
    }),
  );
  assert.match(rejected, /Bukti perlu diperbaiki/);
  assert.doesNotMatch(rejected, /<script>/);
  const review = renderToStaticMarkup(
    createElement(PaymentStatus, {
      paid: true,
      reviewRequired: true,
    }),
  );
  assert.match(review, /Perlu pemeriksaan/);
  assert.doesNotMatch(review, /Lunas/);
});
