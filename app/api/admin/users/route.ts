import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase/admin";
import {
  identity,
  requireManager,
  sameOrigin,
  ApiError,
} from "@/lib/firebase/access";
import { adminEmailAllowed } from "@/lib/access-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const role = z.enum(["customer", "staff", "admin"]);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    email: z.email(),
    name: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(128),
    role,
  }),
  z.object({
    action: z.literal("access"),
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/),
    role,
    disabled: z.boolean(),
  }),
  z.object({
    action: z.literal("delete"),
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^/]+$/),
  }),
]);
function failure(e: unknown) {
  const code = (e as { code?: string }).code;
  const status =
    e instanceof ApiError
      ? e.status
      : e instanceof z.ZodError
        ? 400
        : code === "auth/email-already-exists"
          ? 409
          : 500;
  return NextResponse.json(
    {
      error:
        e instanceof ApiError
          ? e.message
          : status === 400
            ? "Periksa data. Password minimal 8 karakter."
            : status === 409
              ? "Email sudah terdaftar. Ubah akses akun yang sudah ada."
              : "Pengelolaan pengguna belum berhasil.",
    },
    { status },
  );
}
export async function GET(req: NextRequest) {
  try {
    const actor = await identity(req, true);
    requireManager(actor);
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    if (cursor && cursor.length > 2048)
      throw new ApiError(400, "Cursor tidak valid.");
    const result = await adminAuth().listUsers(100, cursor);
    const access = result.users.length
      ? await db().getAll(
          ...result.users.map((u) => db().doc(`access/${u.uid}`)),
        )
      : [];
    const profiles = result.users.length
      ? await db().getAll(
          ...result.users.map((u) => db().doc(`users/${u.uid}`)),
        )
      : [];
    const users = result.users.map((u, i) => ({
      uid: u.uid,
      email: u.email || "",
      name: u.displayName || "",
      phone: profiles[i]?.get("phone") || "",
      createdAt: u.metadata.creationTime,
      verified: u.emailVerified,
      disabled: u.disabled || !!access[i]?.get("disabled"),
      role: adminEmailAllowed(
        u.email || "",
        true,
        process.env.ADMIN_EMAILS || "",
      )
        ? "owner"
        : access[i]?.get("role") || "customer",
      providers: u.providerData.map((p) => p.providerId),
      self: u.uid === actor!.uid,
    }));
    return NextResponse.json(
      { users, cursor: result.pageToken || null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const actor = await identity(req, true);
    requireManager(actor);
    const raw = await req.text();
    if (raw.length > 8000) throw new ApiError(413, "Data terlalu besar.");
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data tidak valid.");
    }
    const input = schema.parse(data);
    if (input.action === "create") {
      if (adminEmailAllowed(input.email, true, process.env.ADMIN_EMAILS || ""))
        throw new ApiError(403, "Akun pemilik harus didaftarkan sendiri.");
      const user = await adminAuth().createUser({
        email: input.email,
        displayName: input.name,
        password: input.password,
        emailVerified: false,
      });
      try {
        await db().doc(`access/${user.uid}`).set({
          role: input.role,
          disabled: false,
          updatedBy: actor!.uid,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        await adminAuth().deleteUser(user.uid);
        throw e;
      }
    } else {
      const target = await adminAuth().getUser(input.uid);
      if (
        target.uid === actor!.uid ||
        adminEmailAllowed(
          target.email || "",
          true,
          process.env.ADMIN_EMAILS || "",
        )
      )
        throw new ApiError(
          403,
          "Akun sendiri dan pemilik tidak dapat diubah di sini.",
        );
      // Deny first, so partial failures cannot leave privileged access active.
      await db()
        .doc(`access/${target.uid}`)
        .set({
          role: input.action === "delete" ? "customer" : input.role,
          disabled: true,
          updatedBy: actor!.uid,
          updatedAt: new Date().toISOString(),
        });
      await adminAuth().revokeRefreshTokens(target.uid);
      if (input.action === "delete") {
        await adminAuth().deleteUser(target.uid);
        await db().doc(`users/${target.uid}`).delete();
      } else {
        await adminAuth().updateUser(target.uid, { disabled: input.disabled });
        await db()
          .doc(`access/${target.uid}`)
          .update({ disabled: input.disabled });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
