import { requestBranch, branchMediaPath } from "@/lib/branches";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  identity,
  requireManager,
  sameOrigin,
  ApiError,
} from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { uploadPhoto, downloadPhoto } from "@/lib/storage/photos";
import { mediaSlotSchema } from "@/lib/site-content";
import { readJpeg } from "@/lib/media-validation";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slot: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const slot = mediaSlotSchema.safeParse((await context.params).slot);
    if (!slot.success) throw new ApiError(404, "Gambar tidak ditemukan.");
    const bytes = await downloadPhoto(
      branchMediaPath(requestBranch(req.url), slot.data),
    );
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const slot = mediaSlotSchema.safeParse((await context.params).slot);
    if (!slot.success) throw new ApiError(400, "Slot gambar tidak valid.");
    const bytes = await readJpeg(req);
    await uploadPhoto(
      branchMediaPath(requestBranch(req.url), slot.data),
      bytes,
    );
    const url = `/api/media/banners/${slot.data}?v=${randomUUID()}&branch=${requestBranch(req.url)}`;
    await db()
      .doc(`settings/${requestBranch(req.url)}`)
      .set(
        { content: { images: { [slot.data]: url } }, updatedBy: user!.uid },
        { merge: true },
      );
    return NextResponse.json({ url });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return NextResponse.json(
    { error: e instanceof ApiError ? e.message : "Gambar belum tersedia." },
    { status: e instanceof ApiError ? e.status : 500 },
  );
}
