import {
  BadgeCheck,
  Clock3,
  CreditCard,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { PaymentSummary } from "@/lib/payments/types";
import type { ManualPaymentSummary } from "@/lib/payments/manual-types";

export type PaymentStatusProps = {
  paid?: boolean;
  manualPayment?: ManualPaymentSummary;
  payment?: PaymentSummary;
  reviewRequired?: boolean;
  compact?: boolean;
};

export default function PaymentStatus({
  paid = false,
  manualPayment,
  payment,
  reviewRequired = false,
  compact = true,
}: PaymentStatusProps) {
  const state = reviewRequired
    ? {
        Icon: ShieldAlert,
        title: "Perlu pemeriksaan",
        detail: "Hubungi toko untuk memastikan pembayaran pesanan ini.",
        className: "border-amber-300 bg-amber-500 text-amber-950",
      }
    : manualPayment?.status === "awaiting_review"
      ? {
          Icon: Clock3,
          title: "Perlu konfirmasi",
          detail:
            "Bukti transfer sudah terkirim. Pembayaran menunggu pemeriksaan toko.",
          className: "border-amber-300 bg-amber-400 text-amber-950",
        }
      : paid || manualPayment?.status === "paid"
        ? {
            Icon: BadgeCheck,
            title: payment?.environment === "sandbox" ? "Lunas (uji)" : "Lunas",
            detail:
              payment?.environment === "sandbox"
                ? "Pembayaran uji Midtrans, tanpa transaksi asli."
                : "Pembayaran telah diperiksa dan dikonfirmasi toko.",
            className: "border-emerald-600 bg-emerald-600 text-white",
          }
        : manualPayment?.status === "rejected"
          ? {
              Icon: XCircle,
              title: "Bukti perlu diperbaiki",
              detail:
                manualPayment.rejectionReason ||
                "Periksa kembali bukti transfer, lalu kirim ulang.",
              className: "border-rose-300 bg-rose-100 text-rose-900",
            }
          : {
              Icon: CreditCard,
              title: "Belum dibayar",
              detail: "Pilih metode pembayaran untuk menyelesaikan tagihan.",
              className: "border-blue-200 bg-blue-50 text-blue-800",
            };
  const Icon = state.Icon;
  if (compact)
    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold leading-none shadow-sm ${state.className}`}
      >
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        {state.title}
      </span>
    );
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${state.className}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <b className="block text-base font-semibold tracking-tight">
          {state.title}
        </b>
        <p className="!mb-0 !mt-1 text-xs leading-relaxed opacity-90">
          {state.detail}
        </p>
      </div>
    </div>
  );
}
