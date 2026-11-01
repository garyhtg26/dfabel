import { createHash, timingSafeEqual } from "node:crypto";
import type { Order } from "../types";
import { calculateOrderPrice } from "../pricing";
import type {
  PaymentAttempt,
  PaymentStatus,
  PaymentSummary,
  ProviderTransaction,
} from "./types";

export const orderIdPattern = /^DF-[A-F0-9]{12}$/;
export const trackingTokenPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function paymentLocked(payment?: PaymentSummary) {
  return !!payment && ["creating", "pending", "paid"].includes(payment.status);
}

export function finalAmount(order: Order): number | null {
  if (
    order.actualKg === null ||
    order.shippingFee === null ||
    !Number.isFinite(order.actualKg) ||
    order.actualKg <= 0 ||
    !Number.isSafeInteger(order.shippingFee) ||
    order.shippingFee < 0
  )
    return null;
  const expected = calculateOrderPrice(order, order.actualKg) + order.shippingFee;
  return Number.isSafeInteger(expected) &&
    expected > 0 &&
    expected <= 10_000_000 &&
    expected === order.total
    ? expected
    : null;
}

export function safeSummary(attempt: PaymentSummary): PaymentSummary {
  return {
    provider: "midtrans",
    attemptId: attempt.attemptId,
    status: attempt.status,
    amount: attempt.amount,
    environment: attempt.environment,
    expiresAt: attempt.expiresAt,
    ...(attempt.paidAt ? { paidAt: attempt.paidAt } : {}),
  };
}

export function validSignature(
  transaction: Pick<
    ProviderTransaction,
    "order_id" | "status_code" | "gross_amount" | "signature_key"
  >,
  key: string,
) {
  if (!/^[a-f\d]{128}$/i.test(transaction.signature_key || "")) return false;
  const expected = createHash("sha512")
    .update(
      transaction.order_id +
        transaction.status_code +
        transaction.gross_amount +
        key,
    )
    .digest();
  return timingSafeEqual(
    expected,
    Buffer.from(transaction.signature_key!, "hex"),
  );
}

export function providerStatus(
  transaction: ProviderTransaction,
): PaymentStatus {
  switch (transaction.transaction_status) {
    case "refund":
    case "partial_refund":
    case "chargeback":
    case "partial_chargeback":
    case "settlement":
      if (
        transaction.status_code !== "200" ||
        (transaction.fraud_status && transaction.fraud_status !== "accept")
      )
        throw Error("PAYMENT_UNVERIFIED_SUCCESS");
      return "paid";
    case "pending":
      return "pending";
    case "expire":
      return "expired";
    case "cancel":
      return "cancelled";
    case "deny":
    case "failure":
      return "failed";
    default:
      throw Error("PAYMENT_UNKNOWN_STATUS");
  }
}

export function financialException(transaction: ProviderTransaction) {
  return [
    "refund",
    "partial_refund",
    "chargeback",
    "partial_chargeback",
  ].includes(transaction.transaction_status);
}

export function providerExpiry(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(" ", "T");
  const qualified = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)
    ? normalized.replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2")
    : `${normalized}+07:00`;
  const timestamp = Date.parse(qualified);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

export function validateTransaction(
  attempt: PaymentAttempt,
  transaction: ProviderTransaction,
  environment: PaymentAttempt["environment"],
  merchantId?: string,
) {
  if (
    attempt.environment !== environment ||
    transaction.order_id !== attempt.attemptId ||
    !/^\d+(?:\.0{1,2})?$/.test(transaction.gross_amount) ||
    Number(transaction.gross_amount) !== attempt.amount ||
    transaction.payment_type !== "qris" ||
    (transaction.currency && transaction.currency !== "IDR") ||
    !transaction.transaction_id ||
    (attempt.transactionId &&
      attempt.transactionId !== transaction.transaction_id) ||
    (merchantId && transaction.merchant_id !== merchantId)
  )
    throw Error("PAYMENT_TRANSACTION_MISMATCH");
  return providerStatus(transaction);
}

export function nextStatus(previous: PaymentStatus, incoming: PaymentStatus) {
  if (previous === "paid" || incoming === "paid") return "paid";
  if (!["creating", "pending"].includes(previous)) return previous;
  return incoming;
}

export function safeQrUrl(url: string | undefined, production: boolean) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !==
        (production ? "api.midtrans.com" : "api.sandbox.midtrans.com") ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !/^\/v[24]\/qris\/[A-Za-z0-9-]+\/qr-code$/.test(parsed.pathname)
    )
      return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}
