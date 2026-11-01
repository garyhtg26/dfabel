import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { ApiError, requireAdmin, type Identity } from "../firebase/access";
import { db } from "../firebase/admin";
import { uploadPhoto } from "../storage/photos";
import type { Order } from "../types";
import { finalAmount } from "./policy";
import {
  bankDetails,
  manualGatewayConflict,
  manualLocked,
  safeManualSummary,
} from "./manual-policy";
import { paymentView, readPaymentOrder, signalPaymentChange } from "./service";
import type {
  ManualPaymentRecord,
  ManualPaymentSummary,
  ManualProof,
  StoredBankSettings,
} from "./manual-types";

function available(order: Order) {
  if (order.paid || manualLocked(order.manualPayment))
    throw new ApiError(
      409,
      "Bukti pembayaran sedang diperiksa atau pesanan sudah lunas.",
    );
  if (manualGatewayConflict(order))
    throw new ApiError(
      409,
      "Selesaikan atau batalkan QRIS aktif sebelum memilih transfer manual.",
    );
}

const unpaid = (): ManualPaymentSummary => ({
  method: "bank_transfer",
  status: "unpaid",
  amount: null,
  hasProof: false,
});

export async function selectManualPayment(
  orderId: string,
  database: Firestore = db(),
) {
  await database.runTransaction(async (tx) => {
    const ref = database.doc(`orders/${orderId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = snap.data() as Order;
    if (order.manualPayment?.bank && !manualGatewayConflict(order)) return;
    available(order);
    const settings = await tx.get(database.doc(`settings/${order.branchId}`));
    const stored = settings.get("manualPayment");
    const bank = bankDetails(stored, order.branchId);
    tx.update(ref, {
      paymentRevision: (order.paymentRevision || 0) + 1,
      manualPayment: {
        ...(order.manualPayment || unpaid()),
        ...(bank.configured
          ? {
              bank: {
                bankName: bank.bankName,
                accountNumber: bank.accountNumber,
                accountHolder: bank.accountHolder,
                ...(stored.version ? { version: stored.version } : {}),
                ...(stored.qrVersion ? { qrVersion: stored.qrVersion } : {}),
              },
            }
          : {}),
      },
    });
    signalPaymentChange(tx, database, order.branchId);
  });
  return paymentView(await readPaymentOrder(orderId, database), database);
}

export async function storeManualProof(
  orderId: string,
  bytes: Uint8Array,
  database: Firestore = db(),
  upload: typeof uploadPhoto = uploadPhoto,
) {
  // Reserve upload capacity before writing any external object. Failed uploads
  // consume the reservation conservatively instead of allowing unbounded orphans.
  await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const rateRef = database.doc(`manualProofLimits/${orderId}`);
    const [snap, rate] = await Promise.all([tx.get(orderRef), tx.get(rateRef)]);
    if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = snap.data() as Order;
    available(order);
    if (!order.manualPayment?.bank)
      throw new ApiError(
        409,
        "Pilih kembali transfer bank setelah rekening toko tersedia.",
      );
    const attempts = ((rate.get("uploads") || []) as number[]).filter(
      (at) => Number.isFinite(at) && at > Date.now() - 3600000,
    );
    if (attempts.length >= 12)
      throw new ApiError(
        429,
        "Terlalu banyak unggahan bukti. Hubungi toko atau coba lagi nanti.",
      );
    tx.set(rateRef, { uploads: [...attempts, Date.now()] });
  });
  const version = randomUUID();
  const path = `payments/proofs/${orderId}/${version}.jpg`;
  await upload(path, bytes);
  await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = snap.data() as Order;
    available(order);
    tx.set(database.doc(`manualProofs/${orderId}`), {
      version,
      path,
      uploadedAt: new Date().toISOString(),
    } satisfies ManualProof);
    tx.update(orderRef, {
      paymentRevision: (order.paymentRevision || 0) + 1,
      manualPayment: safeManualSummary({
        method: "bank_transfer",
        status: "unpaid",
        amount: null,
        bank: order.manualPayment?.bank,
        hasProof: true,
        proofVersion: version,
      }),
    });
    signalPaymentChange(tx, database, order.branchId);
  });
  return paymentView(await readPaymentOrder(orderId, database), database);
}

export async function submitManualPayment(
  orderId: string,
  proofVersion: string,
  database: Firestore = db(),
) {
  await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = orderSnap.data() as Order;
    if (
      order.manualPayment?.status === "awaiting_review" &&
      order.manualPayment.proofVersion === proofVersion
    )
      return;
    available(order);
    const amount = finalAmount(order);
    if (amount === null)
      throw new ApiError(
        409,
        "Tunggu toko mengonfirmasi berat aktual dan ongkir sebelum mengirim bukti pembayaran.",
      );
    const recordRef = database.doc(`manualPayments/${orderId}`);
    const [proofSnap, previous] = await Promise.all([
      tx.get(database.doc(`manualProofs/${orderId}`)),
      tx.get(recordRef),
    ]);
    const proof = proofSnap.data() as ManualProof | undefined;
    if (
      !proof ||
      proof.version !== proofVersion ||
      order.manualPayment?.proofVersion !== proofVersion
    )
      throw new ApiError(
        409,
        "Unggah bukti transfer terbaru sebelum mengirim konfirmasi.",
      );
    if (previous.get("rejectedProofVersion") === proofVersion)
      throw new ApiError(
        409,
        "Bukti sebelumnya ditolak. Unggah bukti transfer yang baru.",
      );
    const bank = bankDetails(order.manualPayment?.bank, order.branchId);
    if (!bank.configured)
      throw new ApiError(409, "Rekening pembayaran belum diatur toko.");
    const summary: ManualPaymentSummary = {
      method: "bank_transfer",
      status: "awaiting_review",
      amount,
      hasProof: true,
      proofVersion,
      submittedAt: new Date().toISOString(),
      bank: order.manualPayment!.bank!,
    };
    tx.set(recordRef, {
      ...summary,
      orderId,
      proofPath: proof.path,
    } satisfies ManualPaymentRecord);
    tx.update(orderRef, {
      manualPayment: summary,
      paymentRevision: (order.paymentRevision || 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    signalPaymentChange(tx, database, order.branchId);
  });
  return paymentView(await readPaymentOrder(orderId, database), database);
}

export async function reviewManualPayment(
  orderId: string,
  proofVersion: string,
  decision: "approve" | "reject",
  note: string,
  user: Identity | null,
  database: Firestore = db(),
) {
  requireAdmin(user);
  if (decision === "reject" && note.trim().length < 3)
    throw new ApiError(400, "Tuliskan alasan penolakan bukti transfer.");
  await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const recordRef = database.doc(`manualPayments/${orderId}`);
    const [orderSnap, recordSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(recordRef),
    ]);
    if (!orderSnap.exists || !recordSnap.exists)
      throw new ApiError(404, "Konfirmasi pembayaran tidak ditemukan.");
    const order = orderSnap.data() as Order;
    const record = recordSnap.data() as ManualPaymentRecord;
    if (
      record.proofVersion !== proofVersion ||
      order.manualPayment?.proofVersion !== proofVersion
    )
      throw new ApiError(
        409,
        "Bukti sudah berubah. Muat ulang sebelum memeriksa pembayaran.",
      );
    if (decision === "approve" && order.paid && record.status === "paid")
      return;
    if (
      record.status !== "awaiting_review" ||
      order.manualPayment?.status !== "awaiting_review" ||
      order.paid
    )
      throw new ApiError(
        409,
        "Pembayaran ini sudah diperiksa. Muat ulang status terbaru.",
      );
    if (manualGatewayConflict(order) || record.amount !== finalAmount(order))
      throw new ApiError(
        409,
        "Tagihan berubah atau pembayaran lain aktif. Periksa pesanan sebelum melanjutkan.",
      );
    const now = new Date().toISOString();
    const summary: ManualPaymentSummary = {
      ...safeManualSummary(record),
      status: decision === "approve" ? "paid" : "rejected",
      ...(decision === "approve"
        ? { confirmedAt: now }
        : { rejectionReason: note.trim() }),
    };
    tx.set(recordRef, {
      ...record,
      ...summary,
      reviewedBy: user!.uid,
      reviewedAt: now,
      ...(decision === "reject" ? { rejectedProofVersion: proofVersion } : {}),
    });
    tx.update(orderRef, {
      manualPayment: summary,
      paymentRevision: (order.paymentRevision || 0) + 1,
      paid: decision === "approve",
      updatedAt: now,
    });
    signalPaymentChange(tx, database, order.branchId);
  });
  return paymentView(await readPaymentOrder(orderId, database), database);
}

export async function confirmManualPayment(
  orderId: string,
  user: Identity | null,
  database: Firestore = db(),
) {
  requireAdmin(user);
  await database.runTransaction(async (tx) => {
    const orderRef = database.doc(`orders/${orderId}`);
    const recordRef = database.doc(`manualPayments/${orderId}`);
    const [orderSnap, recordSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(recordRef),
    ]);
    if (!orderSnap.exists)
      throw new ApiError(404, "Pesanan tidak ditemukan.");
    const order = orderSnap.data() as Order;
    const existing = recordSnap.data() as ManualPaymentRecord | undefined;
    if (order.paid && order.manualPayment?.status === "paid") return;
    if (order.paid)
      throw new ApiError(409, "Pesanan ini sudah berstatus lunas.");
    if (manualGatewayConflict(order))
      throw new ApiError(
        409,
        "Selesaikan atau periksa pembayaran QRIS sebelum mengonfirmasi transfer.",
      );
    const amount = finalAmount(order);
    if (amount === null)
      throw new ApiError(
        409,
        "Isi berat aktual dan ongkir sebelum mengonfirmasi pembayaran.",
      );
    const settingsSnap = await tx.get(
      database.doc(`settings/${order.branchId}`),
    );
    const settings = settingsSnap.get("manualPayment") as
      | Partial<StoredBankSettings>
      | undefined;
    const configuredBank = bankDetails(settings, order.branchId);
    const bank = order.manualPayment?.bank ||
      (configuredBank.configured
        ? {
            bankName: configuredBank.bankName,
            accountNumber: configuredBank.accountNumber,
            accountHolder: configuredBank.accountHolder,
            ...(configuredBank.version
              ? { version: configuredBank.version }
              : {}),
          }
        : undefined);
    if (!bank)
      throw new ApiError(
        409,
        "Rekening transfer belum diatur untuk cabang pesanan ini.",
      );

    const now = new Date().toISOString();
    const summary = safeManualSummary({
      method: "bank_transfer",
      status: "paid",
      amount,
      hasProof: !!order.manualPayment?.hasProof,
      ...(order.manualPayment?.proofVersion
        ? { proofVersion: order.manualPayment.proofVersion }
        : {}),
      ...(order.manualPayment?.submittedAt
        ? { submittedAt: order.manualPayment.submittedAt }
        : {}),
      confirmedAt: now,
      bank,
    });
    tx.set(recordRef, {
      ...existing,
      ...summary,
      orderId,
      ...(existing?.proofPath &&
      existing.proofVersion === summary.proofVersion
        ? { proofPath: existing.proofPath }
        : {}),
      ...(existing?.rejectedProofVersion
        ? { rejectedProofVersion: existing.rejectedProofVersion }
        : {}),
      reviewedBy: user!.uid,
      reviewedAt: now,
      confirmationSource: "admin_dashboard",
    } satisfies ManualPaymentRecord);
    tx.update(orderRef, {
      manualPayment: summary,
      paymentRevision: (order.paymentRevision || 0) + 1,
      paid: true,
      updatedAt: now,
    });
    signalPaymentChange(tx, database, order.branchId);
  });
  return paymentView(await readPaymentOrder(orderId, database), database);
}
