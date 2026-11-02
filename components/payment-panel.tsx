"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileCheck2,
  ImagePlus,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { money } from "@/lib/types";
import { prepareImage } from "@/lib/image-upload";
import { consumePaymentEvents } from "@/lib/payment-stream";
import type { PaymentSummary, PaymentView } from "@/lib/payments/types";
import type { ManualPaymentSummary } from "@/lib/payments/manual-types";
import PaymentStatus from "./payment-status";
import MidtransPayment from "./midtrans-payment";
import { canUploadManualProof } from "@/lib/payments/manual-ui";

type Props = {
  orderId: string;
  trackingToken?: string;
  enabled?: boolean;
  initialPaid?: boolean;
  initialPayment?: PaymentSummary;
  initialManualPayment?: ManualPaymentSummary;
  initialReviewRequired?: boolean;
  hideQrByDefault?: boolean;
  hideProofByDefault?: boolean;
  onChanged?: () => void;
};

function isPaymentView(value: unknown, orderId: string): value is PaymentView {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PaymentView>;
  return (
    result.orderId === orderId &&
    typeof result.paid === "boolean" &&
    typeof result.ready === "boolean" &&
    typeof result.amount === "number" &&
    Number.isFinite(result.amount) &&
    typeof result.enabled === "boolean" &&
    !!result.bank &&
    typeof result.bank.bankName === "string" &&
    typeof result.bank.accountNumber === "string" &&
    typeof result.bank.accountHolder === "string" &&
    typeof result.bank.configured === "boolean"
  );
}

export default function PaymentPanel({
  orderId,
  trackingToken,
  initialPaid = false,
  initialPayment,
  initialManualPayment,
  initialReviewRequired = false,
  hideQrByDefault = false,
  hideProofByDefault = false,
  onChanged,
}: Props) {
  const auth = useAuth();
  const [viewState, setView] = useState<PaymentView | null>(null);
  const view = viewState?.orderId === orderId ? viewState : null;
  const manual = view ? view.manual : initialManualPayment;
  const payment = view ? view.payment : initialPayment;
  const paid = initialPaid || !!view?.paid || manual?.status === "paid";
  const review = view ? view.reviewRequired : initialReviewRequired;
  const [selection, setSelection] = useState<"bank" | "qris" | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(true);
  const [proofAsset, setProofAsset] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const [proofError, setProofError] = useState(false);
  const [proofRevision, setProofRevision] = useState(0);
  const [showQr, setShowQr] = useState(!hideQrByDefault);
  const [showProof, setShowProof] = useState(!hideProofByDefault);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const operation = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const operationRevision = useRef(0);
  const fingerprint = useRef("");
  const acceptedRevision = useRef(-1);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const fileInput = useRef<HTMLInputElement>(null);
  const params = new URLSearchParams({ orderId });
  if (trackingToken) params.set("token", trackingToken);
  const query = params.toString();
  const proofQuery = new URLSearchParams(params);
  if (manual?.proofVersion) proofQuery.set("v", manual.proofVersion);
  const proofEndpoint = `/api/payments/proof?${proofQuery}`;
  const proofKey = `${orderId}:${trackingToken || ""}:${manual?.proofVersion || ""}`;
  const proofUrl = proofAsset?.key === proofKey ? proofAsset.url : "";
  const admin = auth.scope === "admin";
  const pending = manual?.status === "awaiting_review";
  const rejected = manual?.status === "rejected";
  const gatewayActive =
    !!payment && ["creating", "pending"].includes(payment.status);
  const bankSelected = selection === "bank" || !!manual;
  const bank = view?.bank || manual?.bank;
  const bankConfigured =
    !!bank?.accountNumber &&
    !!bank?.accountHolder &&
    (view ? view.bank.configured : true);
  const realQrUrl =
    bankConfigured &&
    view?.bank?.qrUrl &&
    /^\/api\/payments\/bank-qr\?/.test(view.bank.qrUrl)
      ? view.bank.qrUrl
      : "";
  const canSubmit =
    !!view?.ready &&
    bankConfigured &&
    !!manual?.hasProof &&
    !pending &&
    !rejected &&
    !paid &&
    !review;
  const canUploadProof = canUploadManualProof({
    viewLoaded: !!view,
    bankConfigured,
    busy: !!busy,
    paid,
    pendingReview: !!pending,
    reviewRequired: !!review,
    gatewayActive,
  });
  const canAdminConfirm =
    admin &&
    bankConfigured &&
    !!view?.ready &&
    !paid &&
    !pending &&
    !review &&
    !gatewayActive;
  const mode = gatewayActive ? "qris" : selection || (manual ? "bank" : "");

  const accept = useCallback(
    (value: unknown) => {
      if (!mounted.current || !isPaymentView(value, orderId)) return;
      const revision = typeof value.revision === "number" ? value.revision : 0;
      if (revision < acceptedRevision.current) return;
      acceptedRevision.current = revision;
      const next = JSON.stringify([
        value.paid,
        value.ready,
        value.amount,
        value.payment,
        value.manual,
        value.reviewRequired,
        value.bank,
      ]);
      const changed =
        fingerprint.current !== "" && fingerprint.current !== next;
      const firstChanged =
        fingerprint.current === "" &&
        (value.paid !== initialPaid ||
          value.manual?.status !== initialManualPayment?.status);
      fingerprint.current = next;
      setView((prior) => {
        if (prior?.paid && !value.paid)
          return { ...value, paid: true, manual: prior.manual };
        if (
          prior?.manual?.proofVersion === value.manual?.proofVersion &&
          ((prior?.manual?.status === "awaiting_review" &&
            value.manual?.status === "unpaid") ||
            (prior?.manual?.status === "rejected" &&
              value.manual?.status === "awaiting_review"))
        )
          return prior;
        return value;
      });
      setLoading(false);
      if (changed || firstChanged) onChangedRef.current?.();
    },
    [orderId, initialPaid, initialManualPayment?.status],
  );

  const refresh = useCallback(
    async (manualCheck = false) => {
      if (request.current) return;
      const controller = new AbortController();
      const currentGeneration = generation.current;
      const currentOperation = operationRevision.current;
      request.current = controller;
      if (manualCheck) setBusy("check");
      try {
        const response = await auth.request(`/api/payments?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (!response.ok || !isPaymentView(result, orderId))
          throw Error(
            (result as { error?: string })?.error ||
              "Pembayaran belum bisa dimuat.",
          );
        if (
          !controller.signal.aborted &&
          generation.current === currentGeneration &&
          operationRevision.current === currentOperation
        ) {
          accept(result);
          setError("");
        }
      } catch (cause) {
        if (
          !controller.signal.aborted &&
          generation.current === currentGeneration &&
          mounted.current
        ) {
          setError((cause as Error).message);
          setLoading(false);
        }
      } finally {
        if (request.current === controller) request.current = null;
        if (
          mounted.current &&
          generation.current === currentGeneration &&
          manualCheck
        )
          setBusy("");
      }
    },
    [auth.request, query, orderId, accept],
  );

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    fingerprint.current = "";
    acceptedRevision.current = -1;
    setView(null);
    setSelection("");
    setError("");
    setNotice("");
    setLoading(true);
    setRejecting(false);
    setNote("");
    if (document.visibilityState === "visible") void refresh();
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
      operation.current?.abort();
      operation.current = null;
    };
  }, [orderId, trackingToken, auth.user?.uid, auth.scope]);

  useEffect(() => {
    const update = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) void refresh();
      else request.current?.abort();
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);

  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    let connection: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1500;
    const connect = async () => {
      if (stopped) return;
      connection = new AbortController();
      try {
        const response = await auth.request(`/api/payments/events?${query}`, {
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal: connection.signal,
        });
        await consumePaymentEvents(response, (event, data) => {
          if (!stopped && event === "payment") {
            delay = 1500;
            accept(data);
          }
        });
      } catch {
        delay = Math.min(15000, delay * 2);
      }
      if (!stopped) retry = setTimeout(connect, delay);
    };
    void connect();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      stopped = true;
      connection?.abort();
      clearTimeout(retry);
      clearInterval(timer);
    };
  }, [visible, auth.request, query, accept, refresh]);

  useEffect(() => {
    setShowQr(!hideQrByDefault);
  }, [orderId, trackingToken, hideQrByDefault]);

  useEffect(() => {
    setShowProof(!hideProofByDefault);
  }, [orderId, trackingToken, hideProofByDefault]);

  useEffect(() => {
    setProofAsset(null);
    setProofError(false);
    if (!showProof || !manual?.hasProof || !manual.proofVersion) return;
    const controller = new AbortController();
    let url = "";
    void auth
      .request(proofEndpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw Error();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setProofAsset({ key: proofKey, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setProofError(true);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    manual?.proofVersion,
    manual?.hasProof,
    proofEndpoint,
    proofKey,
    proofRevision,
    showProof,
    auth.request,
  ]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function mutate(
    action: "select" | "submit" | "approve" | "reject" | "confirm",
  ) {
    if (operation.current) return;
    const controller = new AbortController();
    const currentGeneration = generation.current;
    operationRevision.current += 1;
    request.current?.abort();
    operation.current = controller;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await auth.request("/api/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          orderId,
          token: trackingToken,
          action,
          ...(!["select", "confirm"].includes(action)
            ? { proofVersion: manual?.proofVersion }
            : {}),
          ...(action === "reject" ? { note } : {}),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isPaymentView(result, orderId))
        throw Error(
          (result as { error?: string })?.error ||
            "Pembayaran belum bisa diperbarui.",
        );
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current
      ) {
        accept(result);
        if (action === "select") setSelection("bank");
        if (action === "submit")
          setNotice(
            "Bukti transfer terkirim. Toko akan memeriksa pembayaranmu.",
          );
        if (action === "approve")
          setNotice("Pembayaran telah dikonfirmasi lunas.");
        if (action === "confirm")
          setNotice("Transfer dikonfirmasi lunas oleh toko.");
        if (action === "reject") {
          setRejecting(false);
          setNote("");
        }
        onChangedRef.current?.();
      }
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current &&
        mounted.current
      )
        setError((cause as Error).message);
    } finally {
      if (operation.current === controller) operation.current = null;
      if (currentGeneration === generation.current && mounted.current)
        setBusy("");
    }
  }

  async function upload(file: File | undefined) {
    if (!file || operation.current) return;
    const controller = new AbortController();
    const currentGeneration = generation.current;
    operationRevision.current += 1;
    request.current?.abort();
    operation.current = controller;
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      const image = await prepareImage(file);
      if (controller.signal.aborted) return;
      const response = await auth.request(`/api/payments/proof?${query}`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: image,
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok || !isPaymentView(result, orderId))
        throw Error(
          (result as { error?: string })?.error ||
            "Bukti transfer belum berhasil diunggah.",
        );
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current
      ) {
        accept(result);
        setSelection("bank");
        setNotice(
          "Bukti sudah diunggah. Ajukan konfirmasi untuk mengirimkannya ke toko.",
        );
      }
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current &&
        mounted.current
      )
        setError((cause as Error).message);
    } finally {
      if (operation.current === controller) operation.current = null;
      if (currentGeneration === generation.current && mounted.current)
        setBusy("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section
      aria-label="Pembayaran pesanan"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CreditIcon />
          </span>
          <div>
            <h3 className="!mb-0 !text-base">Pembayaran</h3>
            <p className="!mb-0 !mt-0.5 text-[11px] text-slate-400">
              {orderId}
            </p>
          </div>
        </div>
        {!!view && (
          <div className="text-right">
            <span className="block text-[9px] text-slate-400">
              {view.ready || paid || pending
                ? "Total tagihan"
                : "Estimasi tagihan"}
            </span>
            <b className="text-lg font-semibold tracking-tight text-slate-900">
              {money(view.amount)}
            </b>
          </div>
        )}
      </div>
      <div className="payment-panel-content p-4 sm:p-5">
        <PaymentStatus
          paid={paid}
          manualPayment={manual}
          payment={payment}
          reviewRequired={review}
          compact={false}
        />
        {notice && (
          <p
            role="status"
            className="!mb-0 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="!mb-0 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-700"
          >
            {error}
          </p>
        )}
        {!admin && !paid && !pending && !review && (
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Pilih metode pembayaran"
          >
            <button
              type="button"
              aria-pressed={mode === "bank"}
              disabled={!!busy || !view}
              onClick={() => void mutate("select")}
              className={`relative flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition sm:p-4 ${mode === "bank" ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <Building2
                  size={22}
                  strokeWidth={1.6}
                  className="text-blue-700"
                />
                {mode === "bank" && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Check size={10} />
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {view?.bank?.bankName || "BCA"} manual
              </span>
              <span className="text-[10px] leading-relaxed text-slate-500">
                Transfer & unggah bukti
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "qris"}
              disabled={!view?.enabled || !!busy || !!manual?.hasProof}
              onClick={() => setSelection("qris")}
              className={`relative flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition sm:p-4 ${view?.enabled ? (mode === "qris" ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-200 bg-white hover:border-indigo-300") : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400"}`}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <QrCode size={22} strokeWidth={1.6} />
                {!view?.enabled && (
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-500">
                    Segera hadir
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold">QRIS otomatis</span>
              <span className="text-[10px] leading-relaxed">
                Mobile banking & e-wallet
              </span>
            </button>
          </div>
        )}

        {loading && !view ? (
          <div
            role="status"
            className="flex items-center gap-2 py-2 text-xs text-slate-500"
          >
            <Loader2 size={16} className="animate-spin" />
            Memuat pilihan pembayaran…
          </div>
        ) : null}

        {mode === "qris" && !paid && !review ? (
          <MidtransPayment
            orderId={orderId}
            trackingToken={trackingToken}
            hideQrByDefault={hideQrByDefault}
            enabled={view?.enabled}
            initialPaid={paid}
            initialPayment={payment}
            initialReviewRequired={review}
            onChanged={() => {
              void refresh();
              onChangedRef.current?.();
            }}
          />
        ) : null}

        {(bankSelected ||
          pending ||
          (paid && !!manual) ||
          (admin && !paid && !pending && !gatewayActive)) &&
          mode !== "qris" && (
            <>
              {!pending && !paid && !view?.ready && (
                <div
                  role="status"
                  className="payment-order-message rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-blue-800"
                >
                  Metode pembayaran sudah dipilih. Toko akan mengonfirmasi berat
                  aktual dan ongkir sebelum kamu membayar.
                </div>
              )}
              {bank && (
                <div className="payment-order-bank overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <Building2 size={16} />
                      {bank.bankName || "BCA"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Transfer manual
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="!mb-1 text-[10px] uppercase tracking-wider text-slate-400">
                      Nomor rekening
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 break-all text-xl font-semibold tracking-[.035em] text-slate-900 sm:text-2xl">
                        {bank.accountNumber || "Belum diatur"}
                      </strong>
                      <button
                        type="button"
                        aria-label="Salin nomor rekening"
                        disabled={!bank.accountNumber}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              bank.accountNumber,
                            );
                            setCopied(true);
                            setError("");
                          } catch {
                            setError(
                              "Nomor rekening belum bisa disalin. Salin angka rekening secara manual.",
                            );
                          }
                        }}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-40"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="!mb-0 !mt-2 text-xs text-slate-500">
                      a.n.{" "}
                      <b className="font-medium text-slate-800">
                        {bank.accountHolder || "Nama pemilik belum diatur"}
                      </b>
                    </p>
                    {copied && (
                      <span
                        role="status"
                        className="mt-2 block text-[10px] font-medium text-emerald-600"
                      >
                        Nomor rekening disalin
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!bankConfigured &&
                (view?.bank.configured ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void mutate("select")}
                    className="payment-order-bank secondary !w-full !rounded-xl !py-3 !text-xs"
                  >
                    Tampilkan rekening pembayaran
                  </button>
                ) : (
                  <p className="payment-order-bank !mb-0 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                    {admin
                      ? "Rekening belum lengkap. Atur rekening pada menu Pembayaran."
                      : "Rekening toko sedang disiapkan. Hubungi toko sebelum melakukan transfer."}
                  </p>
                ))}
              {!admin && !paid && !pending && !review && bankConfigured && (
                <div className="payment-order-actions rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="mb-3 flex items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600">
                      <ImagePlus size={18} />
                    </span>
                    <div>
                      <b className="block text-sm font-semibold text-slate-900">
                        Unggah bukti transfer
                      </b>
                      <p className="!mb-0 !mt-1 text-[11px] leading-relaxed text-slate-500">
                        {manual?.hasProof && !view?.ready
                          ? "Bukti sudah tersimpan. Toko perlu menyimpan berat aktual dan ongkir final sebelum kamu mengajukannya. Tidak perlu unggah ulang."
                          : view?.ready
                            ? "Pilih foto atau tangkapan layar bukti pembayaran."
                            : "Bukti bisa diunggah sekarang. Pengajuan aktif setelah toko menyimpan berat aktual dan ongkir final."}
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInput}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Pilih bukti transfer"
                    onChange={(event) => void upload(event.target.files?.[0])}
                    disabled={!canUploadProof}
                  />
                  <button
                    type="button"
                    disabled={!canUploadProof}
                    onClick={() => fileInput.current?.click()}
                    className="secondary !flex !w-full !items-center !justify-center !gap-2 !rounded-xl !py-3 !text-sm"
                  >
                    {busy === "upload" ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ImagePlus size={17} />
                    )}
                    {busy === "upload"
                      ? "Mengunggah bukti…"
                      : manual?.hasProof
                        ? "Ganti bukti transfer"
                        : "Pilih bukti transfer"}
                  </button>
                  <p className="!mb-0 !mt-2 text-center text-[10px] text-slate-400">
                    JPG, PNG, atau WebP, maksimal 8 MB.
                  </p>
                  {manual?.hasProof && (
                    <button
                      type="button"
                      disabled={!!busy || !canSubmit}
                      onClick={() => void mutate("submit")}
                      className="primary !mt-3 !flex !w-full !items-center !justify-center !gap-2 !rounded-xl !py-3.5 !text-sm disabled:!bg-slate-200 disabled:!text-slate-400"
                    >
                      {busy === "submit" ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <UploadCloud size={17} />
                      )}
                      {busy === "submit"
                        ? "Mengajukan…"
                        : "Saya sudah transfer · Ajukan konfirmasi"}
                    </button>
                  )}
                </div>
              )}
              {admin &&
                bankConfigured &&
                !paid &&
                !pending &&
                !review &&
                !gatewayActive && (
                  <div className="payment-order-actions rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="mb-3">
                      <b className="block text-sm font-semibold text-emerald-950">
                        Konfirmasi pembayaran
                      </b>
                      <p className="!mb-0 !mt-1 text-[11px] leading-relaxed text-emerald-800">
                        Cocokkan mutasi rekening. Konfirmasi admin tidak
                        memerlukan unggahan pelanggan.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!!busy || !canAdminConfirm}
                      onClick={() => void mutate("confirm")}
                      className="!flex !w-full !items-center !justify-center !gap-2 !rounded-xl !bg-emerald-600 !px-4 !py-3 !text-sm !font-semibold !text-white transition hover:!bg-emerald-700 disabled:!bg-slate-200 disabled:!text-slate-500"
                    >
                      {busy === "confirm" ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <BadgeCheck size={17} />
                      )}
                      {busy === "confirm"
                        ? "Menyimpan…"
                        : "Transfer sudah diterima"}
                    </button>
                    {!view?.ready && (
                      <p className="!mb-0 !mt-2 text-[10px] leading-relaxed text-emerald-800">
                        Isi berat aktual dan ongkir pada form pesanan di atas,
                        lalu klik Simpan perubahan. Isi 0 jika ongkir gratis.
                      </p>
                    )}
                  </div>
                )}
              {manual?.hasProof && (
                <div className="payment-order-receipt rounded-xl border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <FileCheck2 size={15} />
                      {pending || paid
                        ? "Bukti transfer"
                        : rejected
                          ? "Bukti sebelumnya"
                          : "Bukti siap diajukan"}
                    </span>
                    {showProof && proofUrl && (
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-medium text-indigo-600"
                      >
                        Lihat penuh
                      </a>
                    )}
                  </div>
                  {hideProofByDefault && (
                    <button
                      type="button"
                      className="secondary !mb-3 !flex !w-full !items-center !justify-center !gap-2 !rounded-xl !py-2 !text-xs"
                      aria-expanded={showProof}
                      onClick={() => setShowProof((value) => !value)}
                    >
                      {showProof ? <EyeOff size={15} /> : <Eye size={15} />}
                      {showProof
                        ? "Sembunyikan bukti transfer"
                        : "Lihat bukti transfer"}
                    </button>
                  )}
                  {showProof &&
                    (proofUrl ? (
                      <img
                        src={proofUrl}
                        alt="Bukti transfer pesanan ini"
                        className="mx-auto max-h-64 w-full rounded-lg bg-slate-50 object-contain"
                      />
                    ) : proofError ? (
                      <button
                        type="button"
                        className="text-button !text-xs"
                        onClick={() => setProofRevision((value) => value + 1)}
                      >
                        Muat ulang bukti transfer
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 py-5 text-xs text-slate-400">
                        <Loader2 size={16} className="animate-spin" />
                        Memuat bukti…
                      </div>
                    ))}
                </div>
              )}
              {!paid && !pending && (bankSelected || admin) && (
                <div className="payment-order-qr rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  {hideQrByDefault && !showQr ? (
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-controls={`manual-payment-qr-${orderId}`}
                      onClick={() => setShowQr(true)}
                      className="secondary !mx-auto !flex !items-center !justify-center !gap-2 !rounded-xl !px-5 !py-3 !text-sm"
                    >
                      <Eye size={17} /> Tampilkan QR
                    </button>
                  ) : (
                    <>
                      <img
                        id={`manual-payment-qr-${orderId}`}
                        src={realQrUrl || "/payment-qr-placeholder.svg"}
                        width={180}
                        height={180}
                        alt={
                          realQrUrl
                            ? `QR pembayaran ${bank?.bankName || "bank"} D’Fable`
                            : "Contoh QR, belum dapat digunakan untuk pembayaran"
                        }
                        className="mx-auto aspect-square w-full max-w-[180px] rounded-lg bg-white object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <p
                        className={`!mb-0 !mt-3 text-[11px] font-medium ${realQrUrl ? "text-slate-500" : "text-amber-700"}`}
                      >
                        {realQrUrl
                          ? "Pembayaran QR ini tetap dikonfirmasi toko setelah bukti dikirim."
                          : "Contoh QR · belum dapat dibayar"}
                      </p>
                      {!realQrUrl && (
                        <p className="!mb-0 !mt-1 text-[10px] text-slate-400">
                          Gunakan nomor rekening di atas untuk transfer.
                        </p>
                      )}
                      {hideQrByDefault && (
                        <button
                          type="button"
                          aria-expanded={true}
                          aria-controls={`manual-payment-qr-${orderId}`}
                          onClick={() => setShowQr(false)}
                          className="secondary !mx-auto !mt-3 !flex !items-center !justify-center !gap-2 !rounded-xl !px-4 !py-2 !text-xs"
                        >
                          <EyeOff size={15} /> Sembunyikan QR
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {pending && !admin && (
                <p className="payment-order-actions !mb-0 rounded-xl bg-amber-50 px-3 py-3 text-center text-xs leading-relaxed text-amber-900">
                  Kamu tidak perlu membayar ulang. Status akan berubah setelah
                  toko memeriksa bukti transfer.
                </p>
              )}
              {pending && admin && !review && (
                <div className="payment-order-actions rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="!mb-3 text-xs font-medium leading-relaxed text-amber-900">
                    Cocokkan bukti dengan mutasi rekening sebelum mengonfirmasi.
                  </p>
                  {rejecting ? (
                    <div className="space-y-3">
                      <label className="!text-xs !font-medium">
                        Alasan penolakan
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Contoh: nominal transfer belum sesuai tagihan"
                          className="!mt-2 !rounded-lg !text-xs"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => {
                            setRejecting(false);
                            setNote("");
                          }}
                          className="secondary !flex-1 !rounded-lg !py-2 !text-xs"
                        >
                          Kembali
                        </button>
                        <button
                          type="button"
                          disabled={!!busy || note.trim().length < 3}
                          onClick={() => void mutate("reject")}
                          className="!flex-1 !rounded-lg !bg-rose-600 !px-3 !py-2 !text-xs !font-semibold !text-white disabled:opacity-50"
                        >
                          {busy === "reject" ? "Menyimpan…" : "Tolak bukti"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => setRejecting(true)}
                        className="secondary !rounded-xl !py-3 !text-xs"
                      >
                        Perlu diperbaiki
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void mutate("approve")}
                        className="!flex !items-center !justify-center !gap-1.5 !rounded-xl !bg-emerald-600 !px-3 !py-3 !text-xs !font-semibold !text-white hover:!bg-emerald-700 disabled:opacity-50"
                      >
                        {busy === "approve" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <BadgeCheck size={16} />
                        )}
                        Konfirmasi lunas
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        {!loading && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void refresh(true)}
            className="text-button !flex !w-full !items-center !justify-center !gap-1.5 !text-[11px] !text-slate-500"
          >
            <RefreshCw
              size={13}
              className={busy === "check" ? "animate-spin" : ""}
            />
            {busy === "check" ? "Memeriksa…" : "Perbarui status pembayaran"}
          </button>
        )}
        <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
          <ShieldCheck size={12} />
          Bukti transfer hanya untuk pesanan ini
        </div>
      </div>
    </section>
  );
}

function CreditIcon() {
  return <Building2 size={19} strokeWidth={1.7} />;
}
