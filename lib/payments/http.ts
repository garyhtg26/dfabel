import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, identity } from "../firebase/access";
import { firebaseReady } from "../firebase/admin";
import { orderIdPattern, trackingTokenPattern } from "./policy";
import { readPaymentOrder } from "./service";

export async function authorizePayment(
  req: NextRequest,
  orderId: string,
  token?: string | null,
) {
  if (!orderIdPattern.test(orderId))
    throw new ApiError(400, "Nomor pesanan tidak valid.");
  if (!firebaseReady())
    throw new ApiError(503, "Layanan pembayaran belum tersedia.");
  const order = await readPaymentOrder(orderId);
  const user = await identity(req);
  if (
    !user?.admin &&
    !(user && user.uid === order.uid) &&
    !(token && trackingTokenPattern.test(token) && token === order.token)
  )
    throw new ApiError(404, "Pesanan tidak ditemukan.");
  return { order, user };
}

export function paymentFailure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: "Data pembayaran tidak valid." },
      { status: 400 },
    );
  // Provider responses can contain credentials or personal data. Do not log them.
  console.error("D’Fable payment failure", {
    reason: "payment_operation_failed",
  });
  return NextResponse.json(
    { error: "Pembayaran sedang diperiksa. Coba lagi beberapa saat." },
    { status: 503 },
  );
}

export const paymentHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
