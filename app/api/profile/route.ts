import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, sameOrigin, ApiError } from "@/lib/firebase/access";
import { adminAuth, db } from "@/lib/firebase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const actor = (await identity(req, true))!;
    const [user, profile] = await Promise.all([
      adminAuth().getUser(actor.uid),
      db().doc(`users/${actor.uid}`).get(),
    ]);
    return NextResponse.json(
      {
        name: user.displayName || "",
        email: user.email || "",
        photoVersion: profile.get("photoVersion") || "",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    sameOrigin(req);
    const actor = (await identity(req, true))!;
    const raw = await req.text();
    if (raw.length > 2000) throw new ApiError(413, "Data terlalu besar.");
    const { name } = z
      .object({ name: z.string().trim().min(2).max(80) })
      .strict()
      .parse(JSON.parse(raw));
    await adminAuth().updateUser(actor.uid, { displayName: name });
    await db().doc(`users/${actor.uid}`).set({ name }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof ApiError ? e.message : "Profil belum berhasil diproses.",
    },
    {
      status:
        e instanceof ApiError
          ? e.status
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : 500,
    },
  );
}
