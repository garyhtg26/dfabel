"use client";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  PackageCheck,
  ReceiptText,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  WashingMachine,
  CircleCheck,
} from "lucide-react";
import { money, statuses, type TrackingOrder, type Service } from "@/lib/types";
import { branches, isBranchId } from "@/lib/branches";
import { speedLabel, unitLabel } from "@/lib/catalog";
import PaymentPanel from "./payment-panel";
import LoyaltyRedemption from "./loyalty-redemption";
import MembershipRedemption from "./membership-redemption";
import { useAuth } from "./auth-provider";
import "./tracking.css";

export const previewTracking: TrackingOrder = {
  id: "DF-CONTOH",
  branchId: "cinere",
  service: "complete",
  kg: 5,
  actualKg: 5,
  express: false,
  status: 6,
  paid: true,
  total: 40000,
  shippingFee: 0,
  date: "2026-10-06",
  slot: "15.00–18.00",
  createdAt: "2026-10-06T02:00:00.000Z",
  history: [
    { status: 0, at: "2026-10-06T02:00:00.000Z" },
    { status: 3, at: "2026-10-06T03:30:00.000Z" },
    { status: 4, at: "2026-10-06T04:00:00.000Z" },
    { status: 5, at: "2026-10-06T06:00:00.000Z" },
    { status: 6, at: "2026-10-06T08:00:00.000Z" },
  ],
};

const stepIcons = [
  ClipboardList,
  CalendarDays,
  Truck,
  Scale,
  WashingMachine,
  Sparkles,
  Truck,
  CircleCheck,
];
export default function Tracking({
  order: o,
  services,
  preview = false,
  trackingToken,
  paymentEnabled,
  onOrderChanged,
  isOwner = false,
}: {
  order: TrackingOrder;
  services: Service[];
  preview?: boolean;
  trackingToken?: string;
  paymentEnabled?: boolean;
  onOrderChanged?: () => void;
  isOwner?: boolean;
}) {
  const auth = useAuth();
  const currentStatus = Math.max(0, Math.min(statuses.length - 1, o.status));
  const startStep = o.source === "pos" ? 3 : 0;
  const StatusIcon = stepIcons[currentStatus] || ClipboardList;
  return (
    <div>
      {preview && (
        <div className="mb-3 rounded-xl bg-amber-50 px-5 py-3 text-xs text-amber-800">
          Contoh tampilan tracking · Bukan pesanan atau posisi kurir asli
        </div>
      )}
      <div className="tracking-detail-grid">
        <section className="tracking-progress-card" aria-label="Status pesanan">
          <div className="tracking-status-hero">
            <div className="tracking-status-top">
              <b>STATUS PESANAN</b>
              <span>{o.id}</span>
            </div>
            <div className="tracking-status-title">
              <span>
                <StatusIcon size={23} />
              </span>
              <div>
                <h2>{statuses[currentStatus]}</h2>
                <p>
                  {currentStatus === 7
                    ? "Pesanan sudah selesai."
                    : "Status diperbarui oleh toko."}
                </p>
              </div>
            </div>
          </div>
          <div className="tracking-progress-body">
            <div className="tracking-progress-heading">
              <h3>Proses cucian</h3>
              <span>
                Tahap {Math.max(1, currentStatus - startStep + 1)} dari{" "}
                {statuses.length - startStep}
              </span>
            </div>
            <ol className="tracking-steps">
              {statuses.map((status, index) => {
                if (index < startStep) return null;
                const Icon = stepIcons[index];
                const isCurrent = index === currentStatus;
                return (
                  <li
                    className={
                      isCurrent
                        ? "current"
                        : index < currentStatus
                          ? "done"
                          : ""
                    }
                    key={status}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className="tracking-step-icon">
                      {index < currentStatus ? (
                        <Check size={16} />
                      ) : (
                        <Icon size={16} />
                      )}
                    </span>
                    <span className="tracking-step-copy">
                      {status}
                      {isCurrent && <small>Status saat ini</small>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="tracking-progress-note">
              <Clock size={15} /> Status diperbarui oleh toko; lokasi kurir
              tidak ditampilkan secara langsung.
            </p>
          </div>
        </section>
        <section
          className="tracking-order-card"
          aria-label="Rincian dan pembayaran"
        >
          <div className="tracking-order-top">
            <div>
              <p className="!mb-1 text-xs text-slate-400">RINCIAN PESANAN</p>
              <h3>
                {services.find((s) => s.id === o.service)?.name ||
                  "Layanan laundry"}
              </h3>
            </div>
            <span className="tracking-order-icon">
              <ReceiptText size={20} />
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              {o.actualKg ?? o.kg}{" "}
              {unitLabel(
                o.unit ?? services.find((s) => s.id === o.service)?.unit,
              )}
              {o.actualKg === null ? " estimasi" : ""}
            </span>
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              {speedLabel(o.speed, o.express)}
            </span>
          </div>
          <div className="my-5 space-y-3 border-y border-slate-100 py-5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Cabang</span>
              <b className="font-medium">
                {isBranchId(o.branchId) ? branches[o.branchId] : "Cinere"}
              </b>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Jadwal masuk / jemput</span>
              <b className="text-right font-medium">
                {o.date}
                <small className="block text-slate-400">{o.slot}</small>
              </b>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Ongkir</span>
              <span>
                {o.shippingFee === null
                  ? "Menunggu konfirmasi"
                  : o.shippingFee === 0
                    ? "Gratis"
                    : money(o.shippingFee)}
              </span>
            </div>
            {o.insurance && (
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Perlindungan cucian</span>
                <span>{money(1000)}</span>
              </div>
            )}
          </div>
          {isOwner && !preview && (
            <>
              <MembershipRedemption order={o} onChanged={onOrderChanged} />
              <LoyaltyRedemption order={o} onChanged={onOrderChanged} />
            </>
          )}
          {!preview && !isOwner && !auth.user && !o.paid && (
            <section className="loyalty-login-hint" aria-label="Poin D’Fable">
              <b>Punya poin D’Fable?</b>
              <p>
                Masuk dengan akun pemilik pesanan untuk menggunakan poin. Jika
                pesanan toko belum terhubung ke akunmu, minta bantuan staf.
              </p>
              <Link
                href={`/?account=1${trackingToken ? `&track=${encodeURIComponent(trackingToken)}` : "&view=tracking"}`}
              >
                Masuk untuk cek poin
              </Link>
            </section>
          )}
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              {o.actualKg === null || o.shippingFee === null
                ? "Estimasi total"
                : "Total tagihan"}
            </span>
            <strong className="text-2xl tracking-tight">
              {money(o.total)}
            </strong>
          </div>
          {preview ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              <ShieldCheck size={18} /> Pembayaran dikonfirmasi
            </div>
          ) : (
            <PaymentPanel
              key={`${o.id}-${o.pointsUsed || 0}-${o.membershipUsed || 0}-${o.paid}`}
              orderId={o.id}
              trackingToken={trackingToken}
              enabled={paymentEnabled}
              initialPaid={o.paid}
              initialPayment={o.payment}
              initialManualPayment={o.manualPayment}
              initialReviewRequired={o.paymentReconciliationRequired}
              hideQrByDefault
              onChanged={onOrderChanged}
            />
          )}
        </section>
      </div>
      <section className="tracking-history-card">
        <h3>Riwayat pesanan</h3>
        <ol className="tracking-history-list">
          {o.history
            .slice()
            .reverse()
            .map((h, i) => (
              <li key={`${h.status}-${h.at}`} className="flex min-w-0 gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${i === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}
                >
                  <Check size={15} />
                </span>
                <div>
                  <b className="block text-xs font-medium text-slate-700">
                    {statuses[h.status]}
                  </b>
                  <time className="mt-1 block text-[11px] text-slate-400">
                    {new Date(h.at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
