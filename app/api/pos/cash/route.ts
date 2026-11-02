import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  identity,
  requireAdmin,
  sameOrigin,
  ApiError,
} from "@/lib/firebase/access";
import { confirmPosCash } from "@/lib/payments/pos-cash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await identity(request, true);
    requireAdmin(user);
    const { orderId, expectedTotal } = z
      .object({
        orderId: z.string().regex(/^DF-[A-F0-9]{12}$/),
        expectedTotal: z.number().int().positive().max(10000000),
      })
      .strict()
      .parse(await request.json());
    await confirmPosCash(orderId, user, undefined, expectedTotal);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? "Data pembayaran tidak valid."
              : "Pembayaran belum bisa disimpan.",
      },
      {
        status:
          error instanceof ApiError
            ? error.status
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}
