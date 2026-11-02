import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, db, firebaseReady } from "@/lib/firebase/admin";
import { ApiError, sameOrigin } from "@/lib/firebase/access";
import { phoneFromLoginEmail, phoneLoginEmail } from "@/lib/phone-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(30),
    password: z.string().min(8).max(128),
  })
  .strict();

export async function POST(req: NextRequest) {
  let createdUid = "";
  try {
    sameOrigin(req);
    if (!firebaseReady())
      throw new ApiError(503, "Pendaftaran belum tersedia.");
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 2048)
      throw new ApiError(413, "Data terlalu besar.");
    const input = schema.parse(JSON.parse(raw));
    const email = phoneLoginEmail(input.phone);
    const phone = phoneFromLoginEmail(email);
    if (!email || !phone)
      throw new ApiError(400, "Nomor WhatsApp tidak valid.");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = createHash("sha256").update(ip).digest("hex");
    const rateRef = db().doc(`phoneRegistrationLimits/${key}`);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const now = Date.now();
      const attempts = (
        Array.isArray(snap.get("attempts")) ? snap.get("attempts") : []
      ).filter(
        (value: unknown): value is number =>
          typeof value === "number" && value > now - 3600000,
      );
      if (attempts.length >= 15)
        throw new ApiError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
      tx.set(rateRef, {
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      });
    });

    const user = await adminAuth().createUser({
      email,
      password: input.password,
      displayName: input.name,
      emailVerified: false,
    });
    createdUid = user.uid;
    await adminAuth().setCustomUserClaims(user.uid, {
      dfable_phone_account: true,
    });
    await db().doc(`users/${user.uid}`).set(
      {
        name: input.name,
        phone,
        phoneVerified: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (createdUid)
      await adminAuth()
        .deleteUser(createdUid)
        .catch(() => {});
    const duplicate =
      (error as { code?: string }).code === "auth/email-already-exists";
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : duplicate
            ? 409
            : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : status === 400
          ? "Periksa nama, nomor WhatsApp, dan password minimal 8 karakter."
          : duplicate
            ? "Nomor ini tidak dapat didaftarkan. Coba masuk atau hubungi toko."
            : "Akun belum bisa dibuat. Coba lagi.";
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
