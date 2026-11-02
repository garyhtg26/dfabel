import type { Order, TrackingOrder } from "./types";
import { safeManualSummary } from "./payments/manual-policy";
// Keep this projection explicit. QR images, provider responses, and detailed
// reconciliation records stay behind the authorized payment endpoint.
export function publicTracking(o: Order): TrackingOrder {
  return {
    id: o.id,
    service: o.service,
    unit: o.unit,
    speed: o.speed,
    pricingVersion: o.pricingVersion,
    minimumQuantity: o.minimumQuantity,
    kg: o.kg,
    actualKg: o.actualKg,
    express: o.express,
    status: o.status,
    paid: o.paid,
    ...(o.manualPayment
      ? { manualPayment: safeManualSummary(o.manualPayment) }
      : {}),
    ...(o.payment
      ? {
          payment: {
            provider: "midtrans" as const,
            attemptId: o.payment.attemptId,
            status: o.payment.status,
            amount: o.payment.amount,
            environment: o.payment.environment,
            expiresAt: o.payment.expiresAt,
            ...(o.payment.paidAt ? { paidAt: o.payment.paidAt } : {}),
          },
        }
      : {}),
    ...(o.paymentReconciliationRequired
      ? { paymentReconciliationRequired: true }
      : {}),
    branchId: o.branchId,
    total: o.total,
    ...(o.pointsUsed ? { pointsUsed: o.pointsUsed } : {}),
    ...(o.pointsEarned ? { pointsEarned: o.pointsEarned } : {}),
    shippingFee: o.shippingFee,
    date: o.date,
    slot: o.slot,
    history: o.history,
    createdAt: o.createdAt,
  };
}
