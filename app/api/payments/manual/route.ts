import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, sameOrigin } from "@/lib/firebase/access";
import {
  authorizePayment,
  paymentFailure,
  paymentHeaders,
} from "@/lib/payments/http";
import {
  selectManualPayment,
  submitManualPayment,
  reviewManualPayment,
  confirmManualPayment,
} from "@/lib/payments/manual-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 4096)
      throw new ApiError(413, "Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data pembayaran tidak valid.");
    }
    const input = z
      .object({
        orderId: z.string().max(30),
        token: z.string().max(40).optional(),
        action: z.enum(["select", "submit", "approve", "reject", "confirm"]),
        proofVersion: z.string().uuid().optional(),
        note: z.string().trim().max(400).optional(),
      })
      .strict()
      .parse(body);
    const { user } = await authorizePayment(req, input.orderId, input.token);
    if (["submit", "approve", "reject"].includes(input.action) && !input.proofVersion)
      throw new ApiError(400, "Versi bukti pembayaran diperlukan.");
    const view =
      input.action === "select"
        ? await selectManualPayment(input.orderId)
        : input.action === "submit"
          ? await submitManualPayment(input.orderId, input.proofVersion!)
          : input.action === "confirm"
            ? await confirmManualPayment(input.orderId, user)
          : await reviewManualPayment(
              input.orderId,
              input.proofVersion!,
              input.action,
              input.note || "",
              user,
            );
    return NextResponse.json(view, { headers: paymentHeaders });
  } catch (error) {
    return paymentFailure(error);
  }
}
