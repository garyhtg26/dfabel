import type { Order, TrackingOrder } from "./types";
export function publicTracking(o: Order): TrackingOrder {
  return {
    id: o.id,
    service: o.service,
    kg: o.kg,
    actualKg: o.actualKg,
    express: o.express,
    status: o.status,
    paid: o.paid,
    total: o.total,
    shippingFee: o.shippingFee,
    date: o.date,
    slot: o.slot,
    history: o.history,
    createdAt: o.createdAt,
  };
}
