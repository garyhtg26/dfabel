import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/firebase/access";
import { db, firebaseReady } from "@/lib/firebase/admin";
import {
  midtransConfig,
  parseTransaction,
  providerGetStatus,
} from "@/lib/payments/midtrans";
import { validSignature, validateTransaction } from "@/lib/payments/policy";
import { applyVerifiedTransaction } from "@/lib/payments/service";
import { paymentFailure } from "@/lib/payments/http";
import type { PaymentAttempt } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!firebaseReady()) throw new ApiError(503, "Layanan belum tersedia.");
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 32768)
      throw new ApiError(413, "Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data tidak valid.");
    }
    let notification;
    try {
      notification = parseTransaction(body);
    } catch {
      throw new ApiError(400, "Notifikasi tidak valid.");
    }
    const config = midtransConfig();
    if (!validSignature(notification, config.key))
      throw new ApiError(401, "Notifikasi tidak terverifikasi.");
    if (!/^DF-[A-F0-9]{12}-[a-f0-9]{20}$/.test(notification.order_id))
      throw new ApiError(400, "Referensi transaksi tidak valid.");
    const snapshot = await db()
      .doc(`paymentAttempts/${notification.order_id}`)
      .get();
    if (!snapshot.exists) throw new ApiError(404, "Transaksi tidak ditemukan.");
    const attempt = snapshot.data() as PaymentAttempt;
    try {
      validateTransaction(
        attempt,
        notification,
        config.environment,
        config.merchantId,
      );
    } catch {
      throw new ApiError(400, "Rincian transaksi tidak sesuai.");
    }
    const verified = await providerGetStatus(attempt.attemptId);
    if (!verified) throw new ApiError(503, "Status transaksi belum tersedia.");
    if (verified.transaction_id !== notification.transaction_id)
      throw new ApiError(400, "Rincian transaksi tidak sesuai.");
    await applyVerifiedTransaction(attempt.attemptId, verified);
    return NextResponse.json({ received: true });
  } catch (error) {
    return paymentFailure(error);
  }
}
