import "server-only";
import { z } from "zod";
import { ApiError } from "../firebase/access";
import { safeQrUrl } from "./policy";
import type { PaymentAttempt, ProviderTransaction } from "./types";

const transactionSchema = z.object({
  order_id: z.string().min(1).max(64),
  gross_amount: z.string().max(30),
  transaction_status: z.string().max(30),
  transaction_id: z.string().min(1).max(100),
  payment_type: z.string().max(30),
  status_code: z.string().max(10),
  currency: z.string().max(5).optional(),
  fraud_status: z.string().max(30).optional(),
  merchant_id: z.string().max(100).optional(),
  signature_key: z.string().max(256).optional(),
  settlement_time: z.string().max(40).optional(),
  expiry_time: z.string().max(40).optional(),
  actions: z
    .array(
      z.object({
        name: z.string(),
        method: z.string(),
        url: z.string().max(1000),
      }),
    )
    .max(10)
    .optional(),
});

export function midtransReady() {
  try {
    midtransConfig();
    return true;
  } catch {
    return false;
  }
}

export function midtransCheckoutEnabled() {
  return process.env.MIDTRANS_QRIS_ENABLED === "true" && midtransReady();
}

export function midtransConfig() {
  const key = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!key)
    throw new ApiError(503, "Pembayaran QRIS belum diaktifkan oleh toko.");
  const mode = process.env.MIDTRANS_IS_PRODUCTION?.trim() || "false";
  if (!["true", "false"].includes(mode))
    throw new ApiError(503, "Konfigurasi pembayaran perlu diperiksa toko.");
  const production = mode === "true";
  if (
    !(production
      ? /^Mid-server-\S+$/.test(key)
      : /^SB-Mid-server-\S+$/.test(key))
  )
    throw new ApiError(503, "Mode dan kunci pembayaran tidak sesuai.");
  return {
    key,
    production,
    environment: production ? ("production" as const) : ("sandbox" as const),
    merchantId: process.env.MIDTRANS_MERCHANT_ID?.trim() || undefined,
    baseUrl: production
      ? "https://api.midtrans.com/v2"
      : "https://api.sandbox.midtrans.com/v2",
  };
}

export class ChargeRejectedError extends ApiError {
  constructor() {
    super(
      503,
      "QRIS belum dapat dibuat. Konfigurasi atau aktivasi pembayaran perlu diperiksa toko.",
    );
  }
}

export function parseTransaction(value: unknown): ProviderTransaction {
  const parsed = transactionSchema.safeParse(value);
  if (!parsed.success) throw Error("PAYMENT_PROVIDER_RESPONSE_INVALID");
  return parsed.data;
}

export async function providerRequest(
  path: string,
  body?: object,
): Promise<ProviderTransaction | null> {
  const config = midtransConfig();
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.key}:`).toString("base64")}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      503,
      "Status pembayaran sedang diperiksa. Coba lagi beberapa saat.",
    );
  }
  const json = await response.json().catch(() => null);
  if (
    path === "/charge" &&
    !json?.transaction_id &&
    ["400", "401", "402", "403"].includes(
      String(json?.status_code || response.status),
    )
  )
    throw new ChargeRejectedError();
  if (response.status === 404 || json?.status_code === "404") return null;
  if (!response.ok || !json || Number(json.status_code) >= 400)
    throw new ApiError(
      503,
      "Layanan QRIS sementara belum tersedia. Coba lagi beberapa saat.",
    );
  return parseTransaction(json);
}

export const providerGetStatus = (id: string) =>
  providerRequest(`/${encodeURIComponent(id)}/status`);

export async function providerCreate(attempt: PaymentAttempt) {
  const response = await providerRequest("/charge", {
    payment_type: "qris",
    qris: { acquirer: "gopay" },
    transaction_details: {
      order_id: attempt.attemptId,
      gross_amount: attempt.amount,
    },
    custom_expiry: {
      order_time: (attempt.requestedAt || attempt.createdAt)
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, " +0000"),
      expiry_duration: 15,
      unit: "minute",
    },
  });
  if (!response) throw Error("PAYMENT_CHARGE_NOT_FOUND");
  return response;
}

export async function providerExpire(id: string) {
  // An expire response can omit transaction fields. The status endpoint is authoritative.
  const config = midtransConfig();
  const response = await fetch(
    `${config.baseUrl}/${encodeURIComponent(id)}/expire`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.key}:`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  // Do not unlock on errors or even a successful expire response until GET confirms it.
  if (!response.ok && response.status !== 412)
    throw new ApiError(503, "Pembatalan QRIS sedang diperiksa. Coba lagi.");
}

export function transactionQr(transaction: ProviderTransaction) {
  const production = midtransConfig().production;
  const action =
    transaction.actions?.find((a) => a.name === "generate-qr-code-v2") ||
    transaction.actions?.find((a) => a.name === "generate-qr-code");
  return safeQrUrl(action?.url, production);
}
