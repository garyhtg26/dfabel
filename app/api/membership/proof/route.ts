import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, ApiError, sameOrigin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { readJpeg } from "@/lib/media-validation";
import { photoStorageReady } from "@/lib/storage/photos";
import { storeMembershipProof } from "@/lib/membership-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = (await identity(req, true))!;
    if (!photoStorageReady())
      throw new ApiError(
        503,
        "Penyimpanan bukti belum tersedia. Hubungi toko.",
      );
    const bytes = await readJpeg(req);
    const result = await storeMembershipProof(db(), user.uid, bytes);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : error instanceof z.ZodError
              ? "Bukti transfer tidak valid."
              : "Bukti transfer belum bisa diunggah.",
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
