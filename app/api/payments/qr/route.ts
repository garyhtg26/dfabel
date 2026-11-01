import { NextRequest } from "next/server";
import { ApiError } from "@/lib/firebase/access";
import {
  authorizePayment,
  paymentFailure,
  paymentHeaders,
} from "@/lib/payments/http";
import { paymentView } from "@/lib/payments/service";
import { midtransConfig } from "@/lib/payments/midtrans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { order } = await authorizePayment(
      req,
      req.nextUrl.searchParams.get("orderId") || "",
      req.nextUrl.searchParams.get("token"),
    );
    const config = midtransConfig();
    if (order.payment?.environment !== config.environment)
      throw new ApiError(
        409,
        "Transaksi dibuat pada mode pembayaran yang berbeda.",
      );
    const view = await paymentView(order);
    if (!view.qrUrl) throw new ApiError(409, "QRIS aktif belum tersedia.");
    const { key } = config;
    const response = await fetch(view.qrUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        Accept: "image/png",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 1_000_000
    )
      throw new ApiError(503, "Gambar QRIS belum bisa dimuat.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (
      bytes.byteLength > 1_000_000 ||
      !signature.every((value, i) => bytes[i] === value)
    )
      throw new ApiError(503, "Gambar QRIS belum bisa dimuat.");
    return new Response(bytes, {
      headers: {
        ...paymentHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="QRIS-${order.id}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
