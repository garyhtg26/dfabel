"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { money } from "@/lib/types";
import type { PaymentSummary, PaymentView } from "@/lib/payments/types";
import { consumePaymentEvents } from "@/lib/payment-stream";

type MidtransPaymentProps = {
  orderId: string;
  trackingToken?: string;
  enabled?: boolean;
  initialPaid?: boolean;
  initialPayment?: PaymentSummary;
  initialReviewRequired?: boolean;
  hideQrByDefault?: boolean;
  onChanged?: () => void;
};

const activeStatuses = new Set(["creating", "pending"]);

function isPaymentView(value: unknown, orderId: string): value is PaymentView {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PaymentView>;
  return (
    result.orderId === orderId &&
    typeof result.enabled === "boolean" &&
    typeof result.paid === "boolean" &&
    typeof result.ready === "boolean" &&
    typeof result.amount === "number" &&
    Number.isFinite(result.amount)
  );
}

function countdown(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return "";
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  if (!Number.isFinite(seconds)) return "";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function MidtransPayment({
  orderId,
  trackingToken,
  enabled = true,
  initialPaid = false,
  initialPayment,
  initialReviewRequired = false,
  hideQrByDefault = false,
  onChanged,
}: MidtransPaymentProps) {
  const auth = useAuth();
  const [viewState, setView] = useState<PaymentView | null>(null);
  const view = viewState?.orderId === orderId ? viewState : null;
  const [loading, setLoading] = useState(enabled && !initialPaid);
  const [action, setAction] = useState<"" | "create" | "cancel">("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [qrAsset, setQrAsset] = useState<{ key: string; url: string } | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const [visible, setVisible] = useState(true);
  const [imageRevision, setImageRevision] = useState(0);
  const [showQr, setShowQr] = useState(!hideQrByDefault);
  const mounted = useRef(true);
  const statusRequest = useRef<AbortController | null>(null);
  const actionRequest = useRef<AbortController | null>(null);
  const fingerprint = useRef("");
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const params = new URLSearchParams({ orderId });
  if (trackingToken) params.set("token", trackingToken);
  const query = params.toString();
  const endpoint = `/api/payments?${query}`;
  const paid = initialPaid || !!view?.paid;
  const payment = view ? view.payment : initialPayment;
  const reviewRequired = view ? view.reviewRequired : initialReviewRequired;
  const qrKey = `${query}:${payment?.attemptId || ""}:${view?.qrUrl || ""}`;
  const qrImage = qrAsset?.key === qrKey ? qrAsset.url : "";
  const sandbox = payment?.environment === "sandbox";
  const active = !!payment && activeStatuses.has(payment.status);
  const localExpired =
    payment?.status === "pending" && Date.parse(payment.expiresAt) <= now;

  const accept = useCallback(
    (value: unknown) => {
      if (!mounted.current || !isPaymentView(value, orderId)) return;
      const nextFingerprint = JSON.stringify([
        value.paid,
        value.ready,
        value.amount,
        value.payment?.attemptId,
        value.payment?.status,
      ]);
      const changed =
        fingerprint.current !== "" && fingerprint.current !== nextFingerprint;
      const newlyPaid =
        value.paid && !initialPaid && fingerprint.current === "";
      fingerprint.current = nextFingerprint;
      setView((prior) => (prior?.paid && !value.paid ? prior : value));
      setLoading(false);
      setError("");
      if (changed || newlyPaid) onChangedRef.current?.();
    },
    [orderId, initialPaid],
  );

  const refresh = useCallback(
    async (manual = false) => {
      if (statusRequest.current || !enabled) return;
      const controller = new AbortController();
      statusRequest.current = controller;
      if (manual) setChecking(true);
      try {
        const response = await auth.request(endpoint, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (!response.ok)
          throw new Error(
            (result as { error?: string })?.error ||
              "Status pembayaran belum bisa diperiksa.",
          );
        if (!isPaymentView(result, orderId))
          throw new Error("Status pembayaran belum bisa diperiksa.");
        if (!controller.signal.aborted) accept(result);
      } catch (cause) {
        if (!controller.signal.aborted && mounted.current) {
          setError((cause as Error).message);
          setLoading(false);
        }
      } finally {
        if (statusRequest.current === controller) statusRequest.current = null;
        if (mounted.current) setChecking(false);
      }
    },
    [auth.request, endpoint, enabled, orderId, accept],
  );

  useEffect(() => {
    mounted.current = true;
    fingerprint.current = "";
    setView(null);
    setError("");
    setQrAsset(null);
    setLoading(enabled && !initialPaid);
    if (document.visibilityState === "visible") void refresh();
    return () => {
      mounted.current = false;
      statusRequest.current?.abort();
      statusRequest.current = null;
      actionRequest.current?.abort();
    };
  }, [
    orderId,
    trackingToken,
    enabled,
    initialPaid,
    auth.user?.uid,
    auth.scope,
  ]);

  useEffect(() => {
    setShowQr(!hideQrByDefault);
  }, [orderId, trackingToken, hideQrByDefault]);

  useEffect(() => {
    const updateVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) {
        setNow(Date.now());
        void refresh();
      } else {
        statusRequest.current?.abort();
      }
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!visible || !enabled || paid || view?.enabled === false) return;
    let stopped = false;
    let connection: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1500;
    const connect = async () => {
      if (stopped) return;
      connection = new AbortController();
      try {
        const response = await auth.request(`/api/payments/events?${query}`, {
          cache: "no-store",
          headers: { Accept: "text/event-stream" },
          signal: connection.signal,
        });
        await consumePaymentEvents(response, (event, value) => {
          if (event === "payment" && !stopped) {
            delay = 1500;
            accept(value);
          }
        });
      } catch {
        // The backup status check stays available while reconnecting.
        delay = Math.min(delay * 2, 15000);
      }
      if (!stopped) retry = setTimeout(connect, delay);
    };
    void connect();
    const reconcile = setInterval(() => void refresh(), 10000);
    return () => {
      stopped = true;
      connection?.abort();
      clearTimeout(retry);
      clearInterval(reconcile);
    };
  }, [
    visible,
    enabled,
    paid,
    view?.enabled,
    query,
    auth.request,
    refresh,
    accept,
  ]);

  useEffect(() => {
    if (!visible || !active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, active]);

  useEffect(() => {
    if (localExpired) void refresh();
  }, [localExpired, refresh]);

  useEffect(() => {
    setQrAsset(null);
    setImageError("");
    if (!view?.qrUrl || !active || paid) return;
    const controller = new AbortController();
    let objectUrl = "";
    void auth
      .request(`/api/payments/qr?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      .then(async (response) => {
        if (!response.ok) throw new Error("QR belum bisa ditampilkan.");
        const blob = await response.blob();
        if (!blob.type.startsWith("image/"))
          throw new Error("QR belum bisa ditampilkan.");
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setQrAsset({ key: qrKey, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setImageError(
            "QR belum bisa ditampilkan. Muat ulang untuk mencoba lagi.",
          );
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    view?.qrUrl,
    payment?.attemptId,
    active,
    paid,
    query,
    qrKey,
    imageRevision,
    auth.request,
  ]);

  async function mutate(nextAction: "create" | "cancel") {
    if (actionRequest.current) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    setAction(nextAction);
    setError("");
    try {
      const response = await auth.request("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token: trackingToken,
          action: nextAction,
        }),
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          (result as { error?: string })?.error ||
            "Pembayaran belum bisa diproses. Periksa status sebelum mencoba lagi.",
        );
      if (!isPaymentView(result, orderId))
        throw new Error("Status pembayaran belum bisa diperiksa.");
      if (!controller.signal.aborted) accept(result);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) {
        setError((cause as Error).message);
        // Recover the existing attempt. A failed response must not create a second QR.
        void refresh();
      }
    } finally {
      actionRequest.current = null;
      if (mounted.current) setAction("");
    }
  }

  if (reviewRequired)
    return (
      <section
        aria-label="Pemeriksaan pembayaran"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
      >
        <div className="flex items-start gap-3" role="status">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={22} />
          <div>
            <b className="block text-sm text-amber-900">
              Pembayaran sedang diperiksa
            </b>
            {sandbox && (
              <span className="mt-1 block text-xs font-medium text-amber-900">
                Mode uji · Simulator Midtrans
              </span>
            )}
            <p className="!mb-0 !mt-1 text-xs leading-relaxed text-amber-800">
              Hubungi toko untuk memastikan tagihan pesanan ini. Jangan membuat
              pembayaran baru terlebih dahulu.
            </p>
          </div>
        </div>
      </section>
    );

  if (paid)
    return (
      <section
        aria-label="Pembayaran pesanan"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
      >
        <div className="flex items-center gap-3" role="status">
          <CheckCircle2 className="shrink-0 text-emerald-600" size={24} />
          <div>
            <b className="block text-sm text-emerald-800">
              {sandbox ? "Pembayaran uji berhasil" : "Pembayaran berhasil"}
            </b>
            <p className="!mb-0 !mt-1 text-xs text-emerald-700">
              {sandbox
                ? "Mode uji Midtrans. Tidak ada pembayaran asli."
                : payment?.provider === "midtrans"
                  ? "QRIS telah dikonfirmasi. Tagihan sudah lunas."
                  : "Tagihan pesanan sudah lunas."}
            </p>
          </div>
        </div>
      </section>
    );

  const unavailable = !enabled || view?.enabled === false;
  const notReady = !!view && !view.ready;
  const ended =
    !!payment && ["expired", "failed", "cancelled"].includes(payment.status);
  const expiresIn = countdown(payment?.expiresAt, now);

  return (
    <section
      aria-label="Pembayaran QRIS"
      className="overflow-hidden rounded-2xl border border-indigo-100 bg-white"
    >
      <div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
          <QrCode size={21} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-sm text-slate-900">Bayar dengan QRIS</b>
          <span className="text-[11px] text-slate-500">
            Mobile banking & e-wallet
          </span>
        </div>
        <span className="text-[11px] font-bold tracking-wider text-slate-700">
          QRIS
        </span>
      </div>
      <div className="p-4">
        {sandbox && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-900">
            Mode uji · Gunakan simulator Midtrans
          </div>
        )}
        {loading ? (
          <div
            className="flex items-center gap-2 py-4 text-sm text-slate-500"
            role="status"
          >
            <Loader2 size={18} className="animate-spin" /> Memeriksa tagihan…
          </div>
        ) : unavailable ? (
          <p className="!mb-0 text-sm leading-relaxed text-slate-500">
            QRIS segera tersedia. Hubungi toko untuk informasi pembayaran.
          </p>
        ) : notReady ? (
          <div
            className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-slate-600"
            role="status"
          >
            <Clock3 className="mt-0.5 shrink-0 text-slate-400" size={19} />
            <div>
              <b className="block text-sm font-medium">
                Tagihan menunggu konfirmasi toko
              </b>
              <p className="!mb-0 !mt-1 text-xs leading-relaxed text-slate-500">
                QRIS tersedia setelah berat aktual dan ongkir dikonfirmasi.
              </p>
            </div>
          </div>
        ) : view ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Total pembayaran</span>
              <b className="text-xl tracking-tight text-slate-900">
                {money(view.amount)}
              </b>
            </div>
            {active ? (
              <>
                {payment?.status === "creating" ? (
                  <div
                    className="flex flex-col items-center gap-3 rounded-xl bg-slate-50 px-5 py-8 text-center"
                    role="status"
                  >
                    <Loader2
                      size={25}
                      className="animate-spin text-indigo-600"
                    />
                    <b className="text-sm">Menyiapkan QR pembayaran</b>
                    <p className="!mb-0 text-xs text-slate-500">
                      Tunggu konfirmasi sebelum membuat pembayaran baru.
                    </p>
                    <button
                      type="button"
                      disabled={!!action || checking}
                      onClick={() => void mutate("create")}
                      className="secondary !mt-2 !rounded-xl !px-4 !py-2 !text-xs"
                    >
                      {action === "create"
                        ? "Memeriksa…"
                        : "Coba tampilkan QR kembali"}
                    </button>
                  </div>
                ) : (
                  <>
                    {hideQrByDefault && !showQr ? (
                      <button
                        type="button"
                        aria-expanded={false}
                        aria-controls={`midtrans-qr-${orderId}`}
                        onClick={() => setShowQr(true)}
                        className="secondary !mx-auto !flex !items-center !justify-center !gap-2 !rounded-xl !px-5 !py-3 !text-sm"
                      >
                        <Eye size={17} /> Tampilkan QRIS
                      </button>
                    ) : (
                      <>
                        <div
                          id={`midtrans-qr-${orderId}`}
                          className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-2"
                        >
                          {qrImage ? (
                            <img
                              src={qrImage}
                              alt={`QRIS pembayaran ${orderId} senilai ${money(view.amount)}`}
                              width={280}
                              height={280}
                              className="aspect-square w-full object-contain"
                            />
                          ) : imageError ? (
                            <div className="px-4 text-center">
                              <p className="!mb-3 text-xs leading-relaxed text-slate-500">
                                {imageError}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setImageRevision((value) => value + 1)
                                }
                                className="text-button !text-xs"
                              >
                                Muat ulang QR
                              </button>
                            </div>
                          ) : (
                            <Loader2
                              size={28}
                              className="animate-spin text-indigo-500"
                              aria-label="Memuat QRIS"
                            />
                          )}
                        </div>
                        {qrImage && !localExpired && (
                          <a
                            href={qrImage}
                            download={`QRIS-${orderId}.png`}
                            className="secondary !mb-3 !mt-3 !flex !w-full !items-center !justify-center !gap-2 !rounded-xl !py-3 !text-sm"
                          >
                            <Download size={16} /> Simpan QRIS
                          </a>
                        )}
                        <p className="!mb-0 text-center text-xs leading-relaxed text-slate-500">
                          {sandbox
                            ? "Gunakan simulator QRIS Midtrans. Jangan bayar QR uji dengan rekening atau e-wallet asli."
                            : "Pindai QR ini atau simpan gambarnya, lalu pilih dari galeri aplikasi pembayaran yang mendukung."}
                        </p>
                        {hideQrByDefault && (
                          <button
                            type="button"
                            aria-expanded={true}
                            aria-controls={`midtrans-qr-${orderId}`}
                            onClick={() => setShowQr(false)}
                            className="secondary !mx-auto !mt-3 !flex !items-center !justify-center !gap-2 !rounded-xl !px-4 !py-2 !text-xs"
                          >
                            <EyeOff size={15} /> Sembunyikan QRIS
                          </button>
                        )}
                      </>
                    )}
                    <div
                      className="mb-4 mt-3 flex items-center justify-center gap-2 text-xs text-slate-500"
                      aria-live="off"
                    >
                      <Clock3 size={14} />
                      {localExpired ? (
                        "Waktu QR habis. Memeriksa pembayaran…"
                      ) : (
                        <>
                          Berlaku selama{" "}
                          <b className="tabular-nums text-indigo-700">
                            {expiresIn || "—"}
                          </b>
                        </>
                      )}
                    </div>
                  </>
                )}
                <div
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-[11px] text-indigo-700"
                  role="status"
                >
                  <span className="size-1.5 rounded-full bg-indigo-500" />{" "}
                  Menunggu konfirmasi pembayaran
                </div>
                {auth.scope === "admin" && (
                  <button
                    type="button"
                    disabled={!!action}
                    onClick={() => void mutate("cancel")}
                    className="text-button !mt-3 !w-full !text-xs !text-slate-500"
                  >
                    {action === "cancel"
                      ? "Membatalkan…"
                      : "Batalkan QR pembayaran"}
                  </button>
                )}
              </>
            ) : (
              <>
                {ended && (
                  <p
                    className="!mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800"
                    role="status"
                  >
                    {payment.status === "expired"
                      ? "QRIS sebelumnya sudah kedaluwarsa."
                      : payment.status === "cancelled"
                        ? "QRIS sebelumnya telah dibatalkan."
                        : "Pembayaran sebelumnya tidak berhasil."}{" "}
                    Buat QRIS baru untuk melanjutkan.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!!action || checking}
                  onClick={() => void mutate("create")}
                  className="primary !flex !w-full !items-center !justify-center !gap-2 !rounded-xl !py-3.5 !text-sm"
                >
                  {action === "create" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <QrCode size={18} />
                  )}
                  {action === "create"
                    ? "Menyiapkan QRIS…"
                    : ended
                      ? "Buat QRIS baru"
                      : "Tampilkan QRIS"}
                </button>
                <p className="!mb-0 !mt-3 text-center text-xs leading-relaxed text-slate-500">
                  Nominal otomatis terisi sesuai tagihan.
                </p>
              </>
            )}
          </>
        ) : null}
        {error && (
          <p
            className="!mb-0 !mt-3 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {!unavailable && !loading && (
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={checking || !!action}
            className="text-button !mt-3 !flex !w-full !items-center !justify-center !gap-2 !text-xs !text-slate-500"
          >
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
            {checking ? "Memeriksa…" : "Periksa status pembayaran"}
          </button>
        )}
        {!unavailable && (
          <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <ShieldCheck size={13} /> Pembayaran diproses oleh Midtrans
          </div>
        )}
      </div>
    </section>
  );
}
