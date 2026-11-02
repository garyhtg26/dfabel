import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, ApiError, sameOrigin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { redeemPoints } from "@/lib/loyalty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    orderId: z.string().regex(/^DF-[A-F0-9]{12}$/),
    points: z.number().int().min(0).max(10000000),
  })
  .strict();
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = (await identity(req, true))!;
    const input = schema.parse(await req.json());
    return NextResponse.json(
      await redeemPoints(db(), user.uid, input.orderId, input.points),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? "Data poin tidak valid."
              : "Poin belum bisa digunakan. Coba lagi.",
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
