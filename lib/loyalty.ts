import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { ApiError } from "./firebase/access";
import { calculateOrderPrice } from "./pricing";
import { finalAmount, paymentLocked } from "./payments/policy";
import { manualLocked, safeManualSummary } from "./payments/manual-policy";
import type { Order } from "./types";

type Wallet = { balance?: number; reconciliationRequired?: boolean };
function balanceOf(value: Wallet | undefined) {
  const balance = value?.balance ?? 0;
  if (!Number.isSafeInteger(balance) || balance < 0)
    throw new ApiError(500, "Saldo poin belum tersedia.");
  return balance;
}

// Read before other transaction writes, then award in the same transaction as settlement.
export async function prepareEarn(
  tx: Transaction,
  database: Firestore,
  order: Order,
) {
  if (
    !order.uid ||
    order.source !== "web" ||
    order.pointsEarned !== undefined ||
    order.actualKg === null
  )
    return null;
  const points = Math.floor(
    (calculateOrderPrice(order, order.actualKg) - (order.pointsUsed || 0)) / 10,
  );
  if (!Number.isSafeInteger(points) || points <= 0) return null;
  const ref = database.doc(`loyalty/${order.uid}`);
  const snapshot = await tx.get(ref);
  return {
    ref,
    balance: balanceOf(snapshot.data() as Wallet | undefined),
    points,
  };
}

export function commitEarn(
  tx: Transaction,
  database: Firestore,
  order: Order,
  earn: Awaited<ReturnType<typeof prepareEarn>>,
  now: string,
) {
  if (!earn || !order.uid) return {};
  tx.set(
    earn.ref,
    { balance: earn.balance + earn.points, updatedAt: now },
    { merge: true },
  );
  tx.set(database.doc(`loyalty/${order.uid}/events/earned-${order.id}`), {
    type: "earned",
    points: earn.points,
    orderId: order.id,
    createdAt: now,
  });
  return { pointsEarned: earn.points };
}

export async function redeemPoints(
  database: Firestore,
  uid: string,
  orderId: string,
  points: number,
) {
  return database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const walletRef = database.doc(`loyalty/${uid}`);
    const [orderSnap, walletSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(walletRef),
    ]);
    if (!orderSnap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = orderSnap.data() as Order;
    if (order.uid !== uid || order.source !== "web")
      throw new ApiError(
        403,
        "Poin hanya dapat digunakan untuk pesanan sendiri.",
      );
    if (
      order.paid ||
      order.paymentReconciliationRequired ||
      paymentLocked(order.payment) ||
      manualLocked(order.manualPayment)
    )
      throw new ApiError(
        409,
        "Poin tidak bisa diubah saat pembayaran sedang diproses atau sudah lunas.",
      );
    if (
      finalAmount(order) === null ||
      order.actualKg === null ||
      order.shippingFee === null
    )
      throw new ApiError(
        409,
        "Tunggu toko mengonfirmasi jumlah dan ongkir sebelum menggunakan poin.",
      );
    const current = order.pointsUsed || 0;
    const service = calculateOrderPrice(order, order.actualKg);
    const wallet = walletSnap.data() as Wallet | undefined;
    if (wallet?.reconciliationRequired && points > current)
      throw new ApiError(
        409,
        "Poin sedang diperiksa toko. Hubungi toko untuk bantuan.",
      );
    const balance = balanceOf(wallet);
    if (
      !Number.isSafeInteger(points) ||
      points < 0 ||
      points > service ||
      points > balance + current
    )
      throw new ApiError(400, "Jumlah poin melebihi saldo atau biaya layanan.");
    if (points === current)
      return {
        balance,
        pointsUsed: current,
        total: order.total,
        paid: order.paid,
      };
    const now = new Date().toISOString();
    const total = service - points + order.shippingFee;
    const paid = total === 0;
    const earned = paid ? Math.floor((service - points) / 10) : 0;
    const nextBalance = balance + current - points + earned;
    tx.set(
      walletRef,
      { balance: nextBalance, updatedAt: now },
      { merge: true },
    );
    tx.set(database.doc(`loyalty/${uid}/events/${randomUUID()}`), {
      type: points > current ? "redeemed" : "returned",
      points: Math.abs(points - current),
      orderId,
      createdAt: now,
    });
    if (paid && earned > 0)
      tx.set(database.doc(`loyalty/${uid}/events/earned-${order.id}`), {
        type: "earned",
        points: earned,
        orderId,
        createdAt: now,
      });
    tx.update(orderRef, {
      pointsUsed: points,
      total,
      paid,
      ...(order.manualPayment?.hasProof
        ? {
            manualPayment: safeManualSummary({
              method: "bank_transfer",
              status: "unpaid",
              amount: null,
              hasProof: false,
              ...(order.manualPayment.bank
                ? { bank: order.manualPayment.bank }
                : {}),
            }),
          }
        : {}),
      ...(paid ? { pointsEarned: earned, paymentMethod: "points" } : {}),
      paymentRevision: (order.paymentRevision || 0) + 1,
      updatedAt: now,
    });
    if (["cinere", "bogor"].includes(order.branchId))
      tx.set(database.doc(`paymentSignals/${order.branchId}`), {
        version: randomUUID(),
        updatedAt: now,
      });
    return { balance: nextBalance, pointsUsed: points, total, paid };
  });
}
