"use client";
import {
  Check,
  Truck,
  WashingMachine,
  PackageCheck,
  House,
  Clock,
  MapPin,
  ShieldCheck,
  ReceiptText,
  Package,
  Shirt,
} from "lucide-react";
import { money, statuses, type TrackingOrder, type Service } from "@/lib/types";
export const previewTracking: TrackingOrder = {
  id: "DF-CONTOH",
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
export default function Tracking({
  order: o,
  services,
  preview = false,
}: {
  order: TrackingOrder;
  services: Service[];
  preview?: boolean;
}) {
  const stage = o.status < 3 ? 0 : o.status < 6 ? 1 : o.status === 6 ? 2 : 3;
  const phases = [
    { icon: Package, name: "Dijemput" },
    { icon: WashingMachine, name: "Dirawat" },
    { icon: Truck, name: "Diantar" },
    { icon: House, name: "Selesai" },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {preview && (
        <div className="bg-amber-50 px-6 py-3 text-xs text-amber-800">
          Contoh tampilan tracking · Bukan pesanan atau posisi kurir asli
        </div>
      )}
      <div className="grid lg:grid-cols-[1.3fr_1fr]">
        <section className="relative overflow-hidden bg-[#2521df] px-6 pb-7 pt-7 text-white sm:px-9 sm:pb-9">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-medium tracking-[.12em]">
              STATUS DARI TOKO
            </span>
            <span className="text-xs text-indigo-200">{o.id}</span>
          </div>
          <div className="mb-10 mt-8 flex items-start justify-between gap-3">
            <div>
              <h2 className="!mb-3 !text-[30px] !leading-tight tracking-tight sm:!text-4xl">
                {stage === 3 ? (
                  <>
                    Sudah kembali.
                    <br />
                    Bersih & rapi.
                  </>
                ) : stage === 2 ? (
                  <>
                    Cucian bersihmu
                    <br />
                    sedang diantar.
                  </>
                ) : stage === 1 ? (
                  <>
                    Sedang dirawat.
                    <br />
                    Sebentar lagi rapi.
                  </>
                ) : (
                  <>
                    Perjalanan bersih
                    <br />
                    dimulai di sini.
                  </>
                )}
              </h2>
              <p className="!mb-0 text-sm text-indigo-200">
                {statuses[o.status]}
              </p>
            </div>
            <span className="mt-1 flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 sm:size-20">
              {stage === 3 ? (
                <PackageCheck size={38} strokeWidth={1.3} />
              ) : stage === 2 ? (
                <Truck size={38} strokeWidth={1.3} />
              ) : (
                <Shirt size={38} strokeWidth={1.3} />
              )}
            </span>
          </div>
          <div
            className="relative flex justify-between"
            aria-label={`Tahap ${stage + 1} dari 4`}
          >
            <div className="absolute left-[6%] right-[6%] top-5 h-1 rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${(stage / 3) * 100}%` }}
              />
            </div>
            {phases.map(({ icon: Icon, name }, i) => (
              <div
                key={name}
                className="relative z-10 flex w-1/4 flex-col items-center gap-3"
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-full border-4 border-[#2521df] ${i <= stage ? "bg-white text-indigo-600" : "bg-[#625ff0] text-indigo-200"}`}
                >
                  {i < stage ? <Check size={19} /> : <Icon size={19} />}
                </span>
                <span
                  className={`text-[11px] ${i === stage ? "font-semibold text-white" : "text-indigo-200"}`}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-4">
            <Clock size={20} className="shrink-0 text-indigo-200" />
            <div>
              <b className="block text-sm font-medium">
                {stage === 3
                  ? "Pesanan selesai"
                  : "Kami kabari setiap tahapnya."}
              </b>
              <span className="text-xs text-indigo-200">
                Status diperbarui toko, bukan lokasi GPS langsung.
              </span>
            </div>
          </div>
        </section>
        <section className="p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="!mb-1 text-xs text-slate-400">RINCIAN PESANAN</p>
              <h3 className="!mb-0 !text-lg">
                {services.find((s) => s.id === o.service)?.name}
              </h3>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
              <ReceiptText size={21} />
            </span>
          </div>
          <div className="flex gap-2 text-xs text-slate-500">
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              {o.actualKg ?? o.kg} kg{o.actualKg === null ? " estimasi" : ""}
            </span>
            <span className="rounded-lg bg-slate-50 px-3 py-2">
              {o.express ? "Express" : "Regular"}
            </span>
          </div>
          <div className="my-5 space-y-3 border-y border-slate-100 py-5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Cabang</span>
              <b className="font-medium">Cinere</b>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Jadwal masuk / jemput</span>
              <b className="text-right font-medium">
                {o.date}
                <small className="block text-slate-400">{o.slot}</small>
              </b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ongkir</span>
              <span>
                {o.shippingFee === null
                  ? "Menunggu konfirmasi"
                  : o.shippingFee === 0
                    ? "Gratis"
                    : money(o.shippingFee)}
              </span>
            </div>
          </div>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {o.actualKg === null || o.shippingFee === null
                ? "Estimasi total"
                : "Total tagihan"}
            </span>
            <strong className="text-2xl tracking-tight">
              {money(o.total)}
            </strong>
          </div>
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-sm ${o.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
          >
            <ShieldCheck size={18} />
            {o.paid ? "Pembayaran dikonfirmasi" : "Menunggu pembayaran"}
          </div>
          {!o.paid && (
            <p className="!mb-0 !mt-3 text-xs leading-relaxed text-slate-400">
              Toko akan mengonfirmasi tagihan final dan instruksi transfer.
            </p>
          )}
        </section>
      </div>
      <section className="border-t border-slate-100 p-6 sm:p-8">
        <h3 className="!mb-6 !text-base">Perjalanan cucianmu</h3>
        <ol className="grid list-none gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {o.history
            .slice()
            .reverse()
            .map((h, i) => (
              <li key={`${h.status}-${h.at}`} className="flex gap-3">
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
