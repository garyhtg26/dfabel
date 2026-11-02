import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { ApiError, requireAdmin, type Identity } from "../firebase/access";
import type { Order } from "../types";
import { finalAmount, paymentLocked } from "./policy";
import { manualLocked } from "./manual-policy";
import { signalPaymentChange } from "./service";
import { prepareEarn, commitEarn } from "../loyalty";

export async function confirmPosCash(
  orderId: string,
  user: Identity | null,
  database: Firestore = db(),
  expectedTotal?: number,
) {
  requireAdmin(user);
  await database.runTransaction(async (tx) => {
    const ref = database.doc(`orders/${orderId}`);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = snapshot.data() as Order;
    if (order.source !== "pos")
      throw new ApiError(403, "Pembayaran tunai hanya untuk pesanan kasir.");
    if (order.paid && order.paymentMethod === "cash") return;
    if (
      order.paid ||
      order.paymentReconciliationRequired ||
      paymentLocked(order.payment) ||
      manualLocked(order.manualPayment)
    )
      throw new ApiError(409, "Pembayaran sedang diperiksa atau sudah lunas.");
    const total = finalAmount(order);
    if (total === null || total <= 0)
      throw new ApiError(
        409,
        "Pastikan tagihan sudah dikonfirmasi sebelum menerima tunai.",
      );
    if (expectedTotal !== undefined && total !== expectedTotal)
      throw new ApiError(
        409,
        "Tagihan berubah. Muat ulang sebelum menerima tunai.",
      );
    const now = new Date().toISOString();
    const earn = await prepareEarn(tx, database, order);
    const earnedFields = commitEarn(tx, database, order, earn, now);
    tx.update(ref, {
      paid: true,
      paidAt: now,
      paymentMethod: "cash",
      paymentRevision: (order.paymentRevision || 0) + 1,
      updatedBy: user!.uid,
      updatedAt: now,
      ...earnedFields,
    });
    signalPaymentChange(tx, database, order.branchId);
  });
}
