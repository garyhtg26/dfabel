import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";
import { identity, sameOrigin, ApiError } from "@/lib/firebase/access";
import {
  MEMBER_CODE_LIFETIME_MS,
  memberCodeHash,
  newMemberCode,
} from "@/lib/membership-code";
import { eligibleMemberDiscount } from "@/lib/membership-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ branch: z.enum(["cinere", "bogor"]) }).strict();
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = (await identity(req, true))!;
    const { branch } = schema.parse(await req.json());
    const database = db();
    const code = newMemberCode();
    const hash = memberCodeHash(code);
    const now = Date.now();
    const expiresAt = now + MEMBER_CODE_LIFETIME_MS;
    await database.runTransaction(async (tx) => {
      const wallet = database.doc(`memberships/${user.uid}`);
      const snap = await tx.get(wallet);
      if (!eligibleMemberDiscount(snap.data()))
        throw new ApiError(
          409,
          "Membership belum aktif, saldo habis, atau saldo sedang diperiksa. Periksa saldo sebelum membuat kode.",
        );
      if (Number(snap.get("codeIssuedAt") || 0) > now - 5000)
        throw new ApiError(429, "Tunggu sebentar sebelum membuat kode baru.");
      const previousHash = snap.get("activeCodeHash");
      if (
        typeof previousHash === "string" &&
        /^[a-f0-9]{64}$/.test(previousHash)
      )
        tx.delete(database.doc(`membershipCodes/${previousHash}`));
      tx.set(
        wallet,
        { activeCodeHash: hash, codeIssuedAt: now },
        { merge: true },
      );
      tx.create(database.doc(`membershipCodes/${hash}`), {
        uid: user.uid,
        branchId: branch,
        expiresAt,
        createdAt: new Date(now).toISOString(),
      });
    });
    return NextResponse.json(
      { code, expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : error instanceof z.ZodError
              ? "Cabang tidak valid."
              : "Kode member belum bisa dibuat.",
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
}
