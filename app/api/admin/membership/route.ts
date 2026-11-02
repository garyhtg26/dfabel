import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  identity,
  requireManager,
  ApiError,
  sameOrigin,
} from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { reviewDeposit } from "@/lib/membership";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/),
    requestId: z.string().uuid(),
    action: z.enum(["confirm", "reject"]),
  })
  .strict();
function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : error instanceof z.ZodError
            ? "Data tidak valid."
            : "Deposit belum bisa diproses.",
    },
    {
      status:
        error instanceof ApiError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    },
  );
}
export async function GET(req: NextRequest) {
  try {
    const user = await identity(req, true);
    requireManager(user);
    const result = await db()
      .collection("membershipDeposits")
      .where("status", "==", "pending")
      .limit(100)
      .get();
    return NextResponse.json(
      {
        requests: result.docs.map((x) => ({
          uid: x.get("uid"),
          requestId: x.get("requestId"),
          amount: x.get("amount"),
          name: x.get("name"),
          senderName: x.get("senderName"),
          branchId: x.get("branchId"),
          createdAt: x.get("createdAt"),
          bank: x.get("bank"),
          hasProof: typeof x.get("proofVersion") === "string",
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const input = schema.parse(await req.json());
    await reviewDeposit(db(), user, input.uid, input.requestId, input.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
