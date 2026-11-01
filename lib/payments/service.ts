import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { Order } from "../types";
import { ApiError } from "../firebase/access";
import { db } from "../firebase/admin";
import {
  midtransConfig,
  midtransReady,
  midtransCheckoutEnabled,
  providerCreate,
  providerExpire,
  providerGetStatus,
  transactionQr,
  ChargeRejectedError,
} from "./midtrans";
import {
  finalAmount,
  financialException,
  nextStatus,
  paymentLocked,
  safeQrUrl,
  safeSummary,
  providerExpiry,
  validateTransaction,
} from "./policy";
import type { PaymentAttempt, PaymentView, ProviderTransaction } from "./types";
import { bankDetails, manualLocked, safeManualSummary } from "./manual-policy";

export const gateway = {
  status: providerGetStatus,
  create: providerCreate,
  expire: providerExpire,
};
export type Gateway = typeof gateway;

export function signalPaymentChange(
  tx: Transaction,
  database: Firestore,
  branchId: string,
) {
  if (!["cinere", "bogor"].includes(branchId)) return;
  tx.set(database.doc(`paymentSignals/${branchId}`), {
    version: randomUUID(),
    updatedAt: new Date().toISOString(),
  });
}

export async function paymentView(
  order: Order,
  database: Firestore = db(),
): Promise<PaymentView> {
  const settings = await database.doc(`settings/${order.branchId}`).get();
  let qrUrl: string | undefined;
  if (
    order.payment?.status === "pending" &&
    !order.paid &&
    !order.paymentReconciliationRequired
  ) {
    const snap = await database
      .doc(`paymentAttempts/${order.payment.attemptId}`)
      .get();
    const attempt = snap.data() as PaymentAttempt | undefined;
    if (
      attempt?.orderId === order.id &&
      midtransReady() &&
      attempt.environment === midtransConfig().environment
    )
      qrUrl = safeQrUrl(attempt.qrUrl, midtransConfig().production);
  }
  return {
    revision: order.paymentRevision || 0,
    enabled: midtransCheckoutEnabled(),
    orderId: order.id,
    paid: order.paid,
    amount: order.total,
    ready:
      finalAmount(order) !== null &&
      !order.paid &&
      !order.paymentReconciliationRequired,
    ...(order.payment ? { payment: safeSummary(order.payment) } : {}),
    ...(qrUrl ? { qrUrl } : {}),
    ...(order.paymentReconciliationRequired ? { reviewRequired: true } : {}),
    branchId: order.branchId,
    bank: bankDetails(
      order.manualPayment?.bank || settings.get("manualPayment"),
      order.branchId,
    ),
    ...(order.manualPayment
      ? { manual: safeManualSummary(order.manualPayment) }
      : {}),
  };
}

export async function readPaymentOrder(id: string, database: Firestore = db()) {
  const snapshot = await database.doc(`orders/${id}`).get();
  if (!snapshot.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
  return snapshot.data() as Order;
}

// Called only after a server-to-server status lookup, never from a browser assertion.
export async function applyVerifiedTransaction(
  attemptId: string,
  transaction: ProviderTransaction,
  database: Firestore = db(),
  issuedAt?: string,
) {
  const config = midtransConfig();
  return database.runTransaction(async (tx) => {
    const attemptRef = database.doc(`paymentAttempts/${attemptId}`);
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists)
      throw new ApiError(404, "Transaksi tidak ditemukan.");
    const attempt = attemptSnap.data() as PaymentAttempt;
    const incoming = validateTransaction(
      attempt,
      transaction,
      config.environment,
      config.merchantId,
    );
    const orderRef = database.doc(`orders/${attempt.orderId}`);
    const orderSnap = await tx.get(orderRef);
    const order = orderSnap.data() as Order | undefined;
    const status = nextStatus(attempt.status, incoming);
    const now = new Date().toISOString();
    const qrUrl = transactionQr(transaction) || attempt.qrUrl;
    const updated: PaymentAttempt = {
      ...attempt,
      status,
      transactionId: transaction.transaction_id,
      updatedAt: now,
      providerState: transaction.transaction_status,
      expiresAt:
        providerExpiry(transaction.expiry_time) ||
        (issuedAt
          ? new Date(Date.parse(issuedAt) + 15 * 60000).toISOString()
          : attempt.expiresAt),
      ...(qrUrl ? { qrUrl } : {}),
      ...(status === "paid" ? { paidAt: attempt.paidAt || now } : {}),
    };
    const current = order?.payment?.attemptId === attempt.attemptId;
    const matchingTotal = order?.total === attempt.amount;
    // A late settlement must remain recorded even after a terminal state or superseded invoice.
    const conflict =
      status === "paid" &&
      (financialException(transaction) ||
        !order ||
        !current ||
        !matchingTotal ||
        (order.paid && order.payment?.status !== "paid") ||
        manualLocked(order.manualPayment));
    if (conflict) updated.reconciliationRequired = true;
    const changed =
      attempt.status !== status ||
      attempt.transactionId !== transaction.transaction_id ||
      attempt.qrUrl !== qrUrl ||
      attempt.expiresAt !== updated.expiresAt ||
      !!updated.reconciliationRequired !== !!attempt.reconciliationRequired;
    tx.set(attemptRef, updated);
    if (order) {
      if (current && (changed || (status === "paid" && !order.paid)))
        tx.update(orderRef, {
          payment: safeSummary(updated),
          paymentRevision: (order.paymentRevision || 0) + 1,
          ...(status === "paid" && matchingTotal ? { paid: true } : {}),
          ...(conflict ? { paymentReconciliationRequired: true } : {}),
          updatedAt: now,
        });
      else if (conflict)
        tx.update(orderRef, {
          paymentReconciliationRequired: true,
          paymentRevision: (order.paymentRevision || 0) + 1,
          updatedAt: now,
        });
    }
    if (changed || conflict)
      signalPaymentChange(tx, database, attempt.branchId);
    return updated;
  });
}

export async function reconcilePayment(
  order: Order,
  database: Firestore = db(),
  api: Gateway = gateway,
  force = false,
) {
  if (!order.payment || !midtransReady()) return order;
  const attemptRef = database.doc(`paymentAttempts/${order.payment.attemptId}`);
  const attempt = await database.runTransaction(async (tx) => {
    const snapshot = await tx.get(attemptRef);
    if (!snapshot.exists) return null;
    const value = snapshot.data() as PaymentAttempt;
    if (value.environment !== midtransConfig().environment)
      throw new ApiError(
        409,
        "Transaksi dibuat pada mode pembayaran yang berbeda.",
      );
    const interval = value.status === "paid" ? 60000 : 8000;
    if (!force && Date.now() - (value.lastCheckedAt || 0) < interval)
      return null;
    tx.update(attemptRef, { lastCheckedAt: Date.now() });
    return value;
  });
  if (attempt) {
    const status = await api.status(attempt.attemptId);
    if (status)
      await applyVerifiedTransaction(attempt.attemptId, status, database);
    // A not-found response is not proof a timed-out creation will never reach the provider.
    // Keep the invoice locked until create can retry with the SAME provider order ID.
  }
  return readPaymentOrder(order.id, database);
}

export async function createPayment(
  orderId: string,
  database: Firestore = db(),
  api: Gateway = gateway,
) {
  if (!midtransCheckoutEnabled())
    throw new ApiError(
      409,
      "QRIS otomatis segera hadir. Pilih transfer bank untuk saat ini.",
    );
  const config = midtransConfig();
  let order = await readPaymentOrder(orderId, database);
  if (order.payment && !order.paid)
    order = await reconcilePayment(order, database, api, true);
  if (order.paid || order.paymentReconciliationRequired)
    return paymentView(order, database);
  const reservation = await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const latest = orderSnap.data() as Order;
    if (
      latest.paid ||
      latest.paymentReconciliationRequired ||
      manualLocked(latest.manualPayment)
    )
      throw new ApiError(409, "Pembayaran pesanan ini perlu diperiksa toko.");
    const amount = finalAmount(latest);
    if (amount === null)
      throw new ApiError(
        409,
        "Tunggu toko mengonfirmasi berat aktual dan ongkir sebelum membayar.",
      );
    if (paymentLocked(latest.payment)) {
      const prior = await tx.get(
        database.doc(`paymentAttempts/${latest.payment!.attemptId}`),
      );
      if (!prior.exists)
        throw new ApiError(409, "Transaksi sedang diperiksa toko.");
      const value = prior.data() as PaymentAttempt;
      if (value.environment !== config.environment)
        throw new ApiError(
          409,
          "Transaksi dibuat pada mode pembayaran yang berbeda.",
        );
      if (
        value.status === "creating" &&
        Date.now() - Date.parse(value.updatedAt) >= 15000
      ) {
        // Acquire a short retry lease. The provider order ID is deliberately unchanged.
        const requestedAt = new Date().toISOString();
        tx.update(prior.ref, { updatedAt: requestedAt, requestedAt });
        return {
          attempt: { ...value, requestedAt },
          shouldCreate: true,
          isNew: false,
        };
      }
      return { attempt: value, shouldCreate: false, isNew: false };
    }
    const rateRef = database.doc(`paymentCreationLimits/${orderId}`);
    const rate = await tx.get(rateRef);
    const timestamps = ((rate.get("attempts") || []) as number[]).filter(
      (at) => Number.isFinite(at) && at > Date.now() - 3600000,
    );
    if (timestamps.length >= 10)
      throw new ApiError(
        429,
        "Terlalu banyak permintaan QRIS. Hubungi toko atau coba lagi nanti.",
      );
    const now = new Date().toISOString();
    const value: PaymentAttempt = {
      provider: "midtrans",
      attemptId: `${orderId}-${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      orderId,
      branchId: latest.branchId,
      amount,
      status: "creating",
      environment: config.environment,
      createdAt: now,
      requestedAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
    };
    tx.create(database.doc(`paymentAttempts/${value.attemptId}`), value);
    tx.set(rateRef, { attempts: [...timestamps, Date.now()] });
    tx.update(orderRef, {
      payment: safeSummary(value),
      paymentRevision: (latest.paymentRevision || 0) + 1,
      updatedAt: now,
    });
    signalPaymentChange(tx, database, latest.branchId);
    return { attempt: value, shouldCreate: true, isNew: true };
  });
  const { attempt, shouldCreate, isNew } = reservation;
  if (shouldCreate) {
    try {
      const result = await api.create(attempt);
      await applyVerifiedTransaction(
        attempt.attemptId,
        result,
        database,
        attempt.requestedAt || attempt.createdAt,
      );
    } catch (error) {
      // This also handles provider duplicate-ID responses after a network timeout.
      let lookupSucceeded = true;
      const result = await api.status(attempt.attemptId).catch(() => {
        lookupSucceeded = false;
        return null;
      });
      if (result)
        await applyVerifiedTransaction(attempt.attemptId, result, database);
      else {
        // Only a definite first-call rejection AND an authenticated not-found lookup
        // proves this newly reserved charge was not created. A timed-out retry is
        // deliberately never unlocked merely because a later key/channel is invalid.
        if (isNew && error instanceof ChargeRejectedError && lookupSucceeded) {
          await database.runTransaction(async (tx) => {
            const attemptRef = database.doc(
              `paymentAttempts/${attempt.attemptId}`,
            );
            const orderRef = database.doc(`orders/${attempt.orderId}`);
            const [currentAttempt, currentOrder] = await Promise.all([
              tx.get(attemptRef),
              tx.get(orderRef),
            ]);
            const value = currentAttempt.data() as PaymentAttempt | undefined;
            const latest = currentOrder.data() as Order | undefined;
            if (
              value?.status !== "creating" ||
              latest?.payment?.attemptId !== attempt.attemptId ||
              latest.paid
            )
              return;
            const failed = {
              ...value,
              status: "failed" as const,
              updatedAt: new Date().toISOString(),
            };
            tx.set(attemptRef, failed);
            tx.update(orderRef, {
              payment: safeSummary(failed),
              paymentRevision: (latest.paymentRevision || 0) + 1,
            });
            signalPaymentChange(tx, database, attempt.branchId);
          });
        }
        throw error;
      }
    }
  }
  return paymentView(await readPaymentOrder(orderId, database), database);
}

export async function cancelPayment(
  orderId: string,
  database: Firestore = db(),
  api: Gateway = gateway,
) {
  let order = await readPaymentOrder(orderId, database);
  if (!order.payment || !paymentLocked(order.payment))
    return paymentView(order, database);
  if (order.paid || order.payment.status === "paid")
    throw new ApiError(
      409,
      "Pembayaran QRIS sudah lunas dan tidak dapat dibatalkan di sini.",
    );
  order = await reconcilePayment(order, database, api, true);
  if (order.paid) return paymentView(order, database);
  if (paymentLocked(order.payment)) {
    await api.expire(order.payment!.attemptId);
    order = await reconcilePayment(order, database, api, true);
    if (paymentLocked(order.payment))
      throw new ApiError(
        409,
        "QRIS belum dikonfirmasi batal. Tagihan tetap terkunci agar tidak terjadi salah bayar.",
      );
  }
  return paymentView(order, database);
}
