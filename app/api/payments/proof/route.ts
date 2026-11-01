import { NextRequest, NextResponse } from "next/server";
import { ApiError, sameOrigin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { readJpeg } from "@/lib/media-validation";
import { downloadPhoto, photoStorageReady } from "@/lib/storage/photos";
import {
  authorizePayment,
  paymentFailure,
  paymentHeaders,
} from "@/lib/payments/http";
import { storeManualProof } from "@/lib/payments/manual-service";
import { proofVersionSchema } from "@/lib/payments/manual-policy";
import type { ManualProof } from "@/lib/payments/manual-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const { order } = await authorizePayment(
      req,
      req.nextUrl.searchParams.get("orderId") || "",
      req.nextUrl.searchParams.get("token"),
    );
    if (!photoStorageReady())
      throw new ApiError(
        503,
        "Penyimpanan bukti pembayaran belum tersedia. Hubungi toko.",
      );
    const bytes = await readJpeg(req);
    const view = await storeManualProof(order.id, bytes);
    return NextResponse.json(view, { headers: paymentHeaders });
  } catch (error) {
    return paymentFailure(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { order } = await authorizePayment(
      req,
      req.nextUrl.searchParams.get("orderId") || "",
      req.nextUrl.searchParams.get("token"),
    );
    const version = proofVersionSchema.parse(req.nextUrl.searchParams.get("v"));
    const snap = await db().doc(`manualProofs/${order.id}`).get();
    const proof = snap.data() as ManualProof | undefined;
    if (
      !proof ||
      !order.manualPayment?.hasProof ||
      proof.version !== order.manualPayment.proofVersion ||
      version !== proof.version
    )
      throw new ApiError(
        404,
        "Bukti pembayaran tidak ditemukan atau sudah berubah.",
      );
    const expected = `payments/proofs/${order.id}/${proof.version}.jpg`;
    if (proof.path !== expected)
      throw new ApiError(404, "Bukti pembayaran tidak ditemukan.");
    const bytes = await downloadPhoto(expected);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...paymentHeaders,
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
