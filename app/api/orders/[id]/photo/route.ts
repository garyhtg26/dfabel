import { downloadPhoto } from "@/lib/storage/photos";
import { NextRequest, NextResponse } from "next/server";
import { identity, ApiError } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = (await identity(req, true))!;
    const { id } = await params;
    if (!/^DF-[A-F0-9]{12}$/.test(id))
      throw new ApiError(404, "Foto tidak ditemukan.");
    const snap = await db().doc(`orders/${id}`).get();
    if (!snap.exists || (!user.admin && snap.get("uid") !== user.uid))
      throw new ApiError(404, "Foto tidak ditemukan.");
    const photoPath = snap.get("photoPath");
    if (!photoPath) throw new ApiError(404, "Foto tidak ditemukan.");
    const bytes = await downloadPhoto(photoPath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ApiError ? e.message : "Foto tidak tersedia." },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}
