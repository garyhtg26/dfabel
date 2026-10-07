import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { identity, sameOrigin, ApiError } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { uploadPhoto, downloadPhoto } from "@/lib/storage/photos";
import { readJpeg } from "@/lib/media-validation";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = (await identity(req, true))!;
    const profile = await db().doc(`users/${user.uid}`).get();
    if (!profile.get("photoVersion"))
      throw new ApiError(404, "Foto belum tersedia.");
    const bytes = await downloadPhoto(`profiles/${user.uid}/avatar.jpg`);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = (await identity(req, true))!;
    const bytes = await readJpeg(req);
    await uploadPhoto(`profiles/${user.uid}/avatar.jpg`, bytes);
    const photoVersion = randomUUID();
    await db().doc(`users/${user.uid}`).set({ photoVersion }, { merge: true });
    return NextResponse.json({ photoVersion });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof ApiError ? e.message : "Foto belum berhasil diproses.",
    },
    { status: e instanceof ApiError ? e.status : 500 },
  );
}
