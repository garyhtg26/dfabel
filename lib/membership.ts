import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { ApiError, requireManager, type Identity } from "./firebase/access";
import { calculateOrderPrice } from "./pricing";
import { finalAmount, paymentLocked } from "./payments/policy";
import { manualLocked, safeManualSummary } from "./payments/manual-policy";
import type { Order } from "./types";

export function memberBalance(value: unknown) {
  const balance = value ?? 0;
  if (!Number.isSafeInteger(balance) || (balance as number) < 0)
    throw new ApiError(500, "Saldo membership belum tersedia.");
  return balance as number;
}

export async function reviewDeposit(
  database: Firestore,
  actor: Identity | null,
  uid: string,
  requestId: string,
  action: "confirm" | "reject",
) {
  requireManager(actor);
  return database.runTransaction(async (tx) => {
    const depositRef = database.doc(`membershipDeposits/${uid}`);
    const walletRef = database.doc(`memberships/${uid}`);
    const [deposit, wallet] = await Promise.all([
      tx.get(depositRef),
      tx.get(walletRef),
    ]);
    if (!deposit.exists || deposit.get("requestId") !== requestId)
      throw new ApiError(409, "Permintaan deposit sudah berubah.");
    if (deposit.get("status") !== "pending") {
      if (
        deposit.get("status") ===
        (action === "confirm" ? "confirmed" : "rejected")
      )
        return;
      throw new ApiError(409, "Permintaan deposit sudah diproses.");
    }
    const amount = deposit.get("amount");
    if (!Number.isSafeInteger(amount) || amount < 100000 || amount > 10000000)
      throw new ApiError(409, "Nominal deposit tidak valid.");
    const now = new Date().toISOString();
    if (action === "confirm") {
      const balance = memberBalance(wallet.get("balance"));
      if (!Number.isSafeInteger(balance + amount))
        throw new ApiError(409, "Saldo melebihi batas.");
      tx.set(
        walletRef,
        { active: true, balance: balance + amount, updatedAt: now },
        { merge: true },
      );
      tx.create(
        database.doc(`memberships/${uid}/events/deposit-${requestId}`),
        {
          type: "deposit",
          amount,
          createdAt: now,
          confirmedBy: actor!.uid,
          branchId: deposit.get("branchId"),
        },
      );
    }
    tx.update(depositRef, {
      status: action === "confirm" ? "confirmed" : "rejected",
      reviewedAt: now,
      reviewedBy: actor!.uid,
    });
  });
}

export async function redeemMembership(
  database: Firestore,
  uid: string,
  orderId: string,
  amount: number,
) {
  return database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const walletRef = database.doc(`memberships/${uid}`);
    const [orderSnap, walletSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(walletRef),
    ]);
    if (!orderSnap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = orderSnap.data() as Order;
    if (order.uid !== uid)
      throw new ApiError(
        403,
        "Saldo hanya dapat dipakai untuk pesanan sendiri.",
      );
    if (
      order.paid ||
      order.paymentReconciliationRequired ||
      paymentLocked(order.payment) ||
      manualLocked(order.manualPayment)
    )
      throw new ApiError(409, "Pembayaran sedang diproses atau sudah lunas.");
    if (
      finalAmount(order) === null ||
      order.actualKg === null ||
      order.shippingFee === null
    )
      throw new ApiError(409, "Tunggu toko mengonfirmasi jumlah dan ongkir.");
    const current = order.membershipUsed || 0;
    const balance = memberBalance(walletSnap.get("balance"));
    if (walletSnap.get("reconciliationRequired") && amount > current)
      throw new ApiError(
        409,
        "Saldo sedang diperiksa toko. Hubungi toko untuk bantuan.",
      );
    const service = calculateOrderPrice(order, order.actualKg);
    if (!walletSnap.get("active") || !order.membershipDiscount)
      throw new ApiError(409, "Membership belum aktif pada pesanan ini.");
    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > balance + current ||
      amount + (order.pointsUsed || 0) > service
    )
      throw new ApiError(400, "Jumlah melebihi saldo atau biaya layanan.");
    if (amount === current)
      return { balance, amount, total: order.total, paid: false };
    const now = new Date().toISOString();
    const total =
      service -
      (order.pointsUsed || 0) -
      amount +
      order.shippingFee +
      (order.insurance ? 1000 : 0);
    const paid = total === 0;
    // The points wallet is read before any writes if this settles the order.
    const pointsRef = database.doc(`loyalty/${uid}`);
    const pointsSnap = paid ? await tx.get(pointsRef) : null;
    const pointsBalance = memberBalance(pointsSnap?.get("balance"));
    const earned = paid
      ? Math.floor((service - (order.pointsUsed || 0)) / 10)
      : 0;
    const nextBalance = balance + current - amount;
    tx.set(
      walletRef,
      { balance: nextBalance, updatedAt: now },
      { merge: true },
    );
    tx.set(database.doc(`memberships/${uid}/events/${randomUUID()}`), {
      type: amount > current ? "redeemed" : "returned",
      amount: Math.abs(amount - current),
      orderId,
      createdAt: now,
    });
    if (earned > 0) {
      tx.set(
        pointsRef,
        { balance: pointsBalance + earned, updatedAt: now },
        { merge: true },
      );
      tx.set(database.doc(`loyalty/${uid}/events/earned-${order.id}`), {
        type: "earned",
        points: earned,
        orderId,
        createdAt: now,
      });
    }
    tx.update(orderRef, {
      membershipUsed: amount,
      total,
      paid,
      ...(paid
        ? { paidAt: now, paymentMethod: "membership", pointsEarned: earned }
        : {}),
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
      paymentRevision: (order.paymentRevision || 0) + 1,
      updatedAt: now,
    });
    if (["cinere", "bogor"].includes(order.branchId))
      tx.set(database.doc(`paymentSignals/${order.branchId}`), {
        version: randomUUID(),
        updatedAt: now,
      });
    return { balance: nextBalance, amount, total, paid };
  });
}
