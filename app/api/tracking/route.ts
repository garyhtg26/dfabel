import { NextRequest, NextResponse } from "next/server";
import { db, firebaseReady } from "@/lib/firebase/admin";
import { publicTracking } from "@/lib/tracking-data";
import type { Order } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  )
    return NextResponse.json(
      {
        error:
          "Gunakan link tracking dari toko, atau masuk untuk mencari nomor pesanan.",
      },
      { status: 400 },
    );
  if (!firebaseReady())
    return NextResponse.json(
      { error: "Tracking belum diaktifkan." },
      { status: 503 },
    );
  try {
    const link = await db().doc(`tracking/${token}`).get();
    if (!link.exists)
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    const order = await db()
      .doc(`orders/${link.get("orderId")}`)
      .get();
    if (!order.exists)
      return NextResponse.json(
        { error: "Pesanan tidak ditemukan." },
        { status: 404 },
      );
    return NextResponse.json(publicTracking(order.data() as Order), {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Tracking sementara tidak tersedia." },
      { status: 503 },
    );
  }
}
