import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  identity,
  requireManager,
  sameOrigin,
} from "@/lib/firebase/access";
import { requestBranch } from "@/lib/branches";
import { readJpeg } from "@/lib/media-validation";
import { photoStorageReady } from "@/lib/storage/photos";
import { setBankQr } from "@/lib/payments/bank-service";
import { paymentFailure, paymentHeaders } from "@/lib/payments/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const expectedVersion = req.headers.get("if-match");
    if (!expectedVersion)
      throw new ApiError(
        409,
        "Muat ulang pengaturan rekening sebelum mengunggah QR.",
      );
    if (!photoStorageReady())
      throw new ApiError(503, "Penyimpanan QR belum tersedia.");
    const bytes = await readJpeg(req);
    return NextResponse.json(
      await setBankQr(
        requestBranch(req.url),
        bytes,
        user,
        undefined,
        undefined,
        expectedVersion,
      ),
      { headers: paymentHeaders },
    );
  } catch (error) {
    return paymentFailure(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const expectedVersion = req.headers.get("if-match");
    if (!expectedVersion)
      throw new ApiError(
        409,
        "Muat ulang pengaturan rekening sebelum menghapus QR.",
      );
    return NextResponse.json(
      await setBankQr(
        requestBranch(req.url),
        null,
        user,
        undefined,
        undefined,
        expectedVersion,
      ),
      { headers: paymentHeaders },
    );
  } catch (error) {
    return paymentFailure(error);
  }
}
