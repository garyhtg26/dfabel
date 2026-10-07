import { requestBranch } from "@/lib/branches";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  identity,
  requireManager,
  sameOrigin,
  ApiError,
} from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { contentSchema } from "@/lib/site-content";
export const runtime = "nodejs";
export async function PATCH(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await identity(req, true);
    requireManager(user);
    const raw = await req.text();
    if (raw.length > 5000) throw new ApiError(413, "Data terlalu besar.");
    const content = contentSchema.parse(JSON.parse(raw));
    await db()
      .doc(`settings/${requestBranch(req.url)}`)
      .set({ content, updatedBy: user!.uid }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ApiError ? e.message : "Konten belum berhasil disimpan.",
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
}
