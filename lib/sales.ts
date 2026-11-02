import type { Order } from "./types";

/** Value of paid orders, after discounts and points, before membership credit.
 * A deposit is not included until it is used against an order. */
export function paidOrderSalesValue(
  order: Pick<
    Order,
    | "paid"
    | "paymentReconciliationRequired"
    | "payment"
    | "total"
    | "membershipUsed"
  >,
): number {
  if (
    !order.paid ||
    order.paymentReconciliationRequired ||
    order.payment?.environment === "sandbox"
  )
    return 0;
  return order.total + (order.membershipUsed || 0);
}
