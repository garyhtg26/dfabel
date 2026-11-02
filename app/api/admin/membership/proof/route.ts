import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, requireManager, ApiError } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { downloadPhoto } from "@/lib/storage/photos";
import { membershipProofPath } from "@/lib/membership-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z
  .object({
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/),
    requestId: z.string().uuid(),
  })
  .strict();
export async function GET(req: NextRequest) {
  try {
    const user = await identity(req, true);
    requireManager(user);
    const { uid, requestId } = query.parse({
      uid: req.nextUrl.searchParams.get("uid"),
      requestId: req.nextUrl.searchParams.get("requestId"),
    });
    const deposit = await db().doc(`membershipDeposits/${uid}`).get();
    const version = deposit.get("proofVersion");
    if (
      !deposit.exists ||
      deposit.get("requestId") !== requestId ||
      typeof version !== "string"
    )
      throw new ApiError(404, "Bukti deposit tidak ditemukan.");
    const bytes = await downloadPhoto(membershipProofPath(uid, version));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : error instanceof z.ZodError
              ? "Data bukti tidak valid."
              : "Bukti deposit belum tersedia.",
      },
      {
        status:
          error instanceof ApiError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
