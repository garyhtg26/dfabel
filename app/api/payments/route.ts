import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, requireAdmin, sameOrigin } from "@/lib/firebase/access";
import {
  authorizePayment,
  paymentFailure,
  paymentHeaders,
} from "@/lib/payments/http";
import {
  cancelPayment,
  createPayment,
  paymentView,
  reconcilePayment,
} from "@/lib/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { order } = await authorizePayment(
      req,
      req.nextUrl.searchParams.get("orderId") || "",
      req.nextUrl.searchParams.get("token"),
    );
    const latest = await reconcilePayment(order);
    return NextResponse.json(await paymentView(latest), {
      headers: paymentHeaders,
    });
  } catch (error) {
    return paymentFailure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 4096)
      throw new ApiError(413, "Data terlalu besar.");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data pembayaran tidak valid.");
    }
    const input = z
      .object({
        orderId: z.string().max(30),
        token: z.string().max(40).optional(),
        action: z.enum(["create", "cancel"]),
      })
      .parse(parsed);
    const { user } = await authorizePayment(req, input.orderId, input.token);
    if (input.action === "cancel") requireAdmin(user);
    const view =
      input.action === "create"
        ? await createPayment(input.orderId)
        : await cancelPayment(input.orderId);
    return NextResponse.json(view, { headers: paymentHeaders });
  } catch (error) {
    return paymentFailure(error);
  }
}
