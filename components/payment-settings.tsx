"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  Landmark,
  Loader2,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { prepareImage } from "@/lib/image-upload";
import { branches, type BranchId } from "@/lib/branches";
import type { BankAccount, BankDetails } from "@/lib/payments/manual-types";

const initialAccount: BankAccount = {
  bankName: "BCA",
  accountNumber: "",
  accountHolder: "",
};

function parseBank(value: unknown): BankDetails {
  if (!value || typeof value !== "object")
    throw Error("Pengaturan pembayaran belum bisa dimuat.");
  const bank = value as Partial<BankDetails>;
  if (
    typeof bank.bankName !== "string" ||
    typeof bank.accountNumber !== "string" ||
    typeof bank.accountHolder !== "string" ||
    typeof bank.configured !== "boolean" ||
    (bank.qrUrl !== undefined && typeof bank.qrUrl !== "string")
  )
    throw Error("Pengaturan pembayaran belum bisa dimuat.");
  return bank as BankDetails;
}

export default function PaymentSettings({
  branchId,
  onSaved,
}: {
  branchId: BranchId;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const uploadId = useId();
  const [account, setAccount] = useState<BankAccount>(initialAccount);
  const [saved, setSaved] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "account" | "qr" | "remove">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const changeBranch = useRef(branchId);
  changeBranch.current = branchId;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const endpoint = `/api/admin/payments?branch=${branchId}`;
  const qrEndpoint = `/api/admin/payments/qr?branch=${branchId}`;
  const qrUrl = saved?.qrUrl;
  const changed =
    account.bankName !== saved?.bankName ||
    account.accountNumber !== saved?.accountNumber ||
    account.accountHolder !== saved?.accountHolder;

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setLoading(true);
    setAccount(initialAccount);
    setSaved(null);
    setError("");
    setNotice("");
    setBusy("");
    void auth
      .request(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok)
          throw Error(
            (data as { error?: string }).error ||
              "Pengaturan pembayaran belum bisa dimuat.",
          );
        const bank = parseBank(data);
        if (controller.signal.aborted || current !== generation.current) return;
        setSaved(bank);
        setAccount({
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountHolder: bank.accountHolder,
        });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && current === generation.current)
          setError((cause as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current)
          setLoading(false);
      });
    return () => {
      controller.abort();
      generation.current++;
    };
  }, [endpoint, retry, auth.request]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  function updateAccount(key: keyof BankAccount, value: string) {
    setAccount((previous) => ({ ...previous, [key]: value }));
    setNotice("");
    setError("");
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading) return;
    const current = generation.current;
    setBusy("account");
    setError("");
    setNotice("");
    try {
      const response = await auth.request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: account.bankName.trim(),
          accountNumber: account.accountNumber.trim(),
          accountHolder: account.accountHolder.trim(),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok)
        throw Error(
          (result as { error?: string }).error ||
            "Rekening belum berhasil disimpan.",
        );
      const bank = parseBank(result);
      if (current !== generation.current) return;
      const needsNewQr = !!saved?.qrUrl && !bank.qrUrl;
      setSaved(bank);
      setAccount({
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountHolder: bank.accountHolder,
      });
      setNotice(
        needsNewQr
          ? `Rekening ${branches[branchId]} diperbarui. Unggah ulang QR yang sesuai dengan rekening ini.`
          : `Rekening ${branches[branchId]} sudah diperbarui.`,
      );
      onSavedRef.current();
    } catch (cause) {
      if (current === generation.current) setError((cause as Error).message);
    } finally {
      if (current === generation.current) setBusy("");
    }
  }

  async function updateQr(file?: File) {
    if (busy || loading || (file && changed)) return;
    const current = generation.current;
    const requestedBranch = branchId;
    setBusy(file ? "qr" : "remove");
    setError("");
    setNotice("");
    try {
      const image = file ? await prepareImage(file, 1600) : undefined;
      if (
        current !== generation.current ||
        changeBranch.current !== requestedBranch
      )
        return;
      const response = await auth.request(qrEndpoint, {
        method: file ? "POST" : "DELETE",
        headers: {
          "If-Match": saved?.version || "unconfigured",
          ...(image ? { "Content-Type": "image/jpeg" } : {}),
        },
        ...(image ? { body: image } : {}),
      });
      const result: unknown = await response.json();
      if (!response.ok)
        throw Error(
          (result as { error?: string }).error ||
            "Gambar QR belum berhasil diperbarui.",
        );
      const bank = parseBank(result);
      if (current !== generation.current) return;
      setSaved(bank);
      setNotice(
        file
          ? `QR pembayaran ${branches[branchId]} sudah diperbarui.`
          : "QR pembayaran dihapus. Pelanggan tetap bisa transfer ke rekening.",
      );
      onSavedRef.current();
    } catch (cause) {
      if (current === generation.current) setError((cause as Error).message);
    } finally {
      if (current === generation.current) setBusy("");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600">
          <ShieldCheck size={21} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div>
          <h2 className="!mb-1 !text-sm font-semibold text-indigo-950">
            Pengaturan pembayaran {branches[branchId]}
          </h2>
          <p className="!mb-0 !text-xs leading-relaxed text-indigo-700">
            Pelanggan cabang {branches[branchId]} akan melihat rekening ini.
            Hanya pemilik dan admin yang bisa mengubahnya.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"
          role="status"
        >
          <Loader2 size={19} className="animate-spin" aria-hidden="true" />
          Memuat pengaturan pembayaran…
        </div>
      ) : !saved ? (
        <div className="rounded-2xl border border-red-100 bg-white p-6">
          <p className="!mb-4 text-sm text-red-700" role="alert">
            {error || "Pengaturan pembayaran belum tersedia."}
          </p>
          <button
            type="button"
            className="secondary !text-sm"
            onClick={() => setRetry((value) => value + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
          <div className="min-w-0 space-y-6">
            <form
              onSubmit={saveAccount}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <Landmark
                  size={21}
                  strokeWidth={1.7}
                  className="text-indigo-600"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="!mb-0 !text-base font-semibold text-slate-900">
                    Rekening transfer
                  </h2>
                  <p className="!mb-0 !mt-1 !text-xs text-slate-500">
                    Berlaku untuk pesanan web dan kasir.
                  </p>
                </div>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${saved.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {saved.configured ? "Aktif" : "Belum diatur"}
                </span>
              </div>
              <fieldset
                disabled={!!busy}
                className="space-y-5 px-5 py-6 disabled:opacity-70 sm:px-6"
              >
                <label className="!block !text-xs font-medium text-slate-600">
                  Nama bank
                  <input
                    required
                    name="bankName"
                    autoComplete="off"
                    maxLength={50}
                    placeholder="BCA"
                    value={account.bankName}
                    onChange={(event) =>
                      updateAccount("bankName", event.target.value)
                    }
                    className="!mt-2 !w-full !rounded-xl !border-slate-200 !px-3.5 !py-3 !text-sm focus:!border-indigo-400 focus:!ring-4 focus:!ring-indigo-50"
                  />
                </label>
                <label className="!block !text-xs font-medium text-slate-600">
                  Nomor rekening
                  <input
                    required
                    name="accountNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    minLength={6}
                    maxLength={30}
                    pattern="[0-9]{6,30}"
                    title="Isi 6 sampai 30 digit nomor rekening."
                    placeholder="Masukkan nomor rekening toko"
                    value={account.accountNumber}
                    onChange={(event) =>
                      updateAccount(
                        "accountNumber",
                        event.target.value.replace(/\D/g, ""),
                      )
                    }
                    className="!mt-2 !w-full !rounded-xl !border-slate-200 !px-3.5 !py-3 !text-sm tabular-nums focus:!border-indigo-400 focus:!ring-4 focus:!ring-indigo-50"
                  />
                </label>
                <label className="!block !text-xs font-medium text-slate-600">
                  Nama pemilik rekening
                  <input
                    required
                    name="accountHolder"
                    minLength={2}
                    maxLength={100}
                    autoComplete="off"
                    placeholder="Sesuai nama pada rekening bank"
                    value={account.accountHolder}
                    onChange={(event) =>
                      updateAccount("accountHolder", event.target.value)
                    }
                    className="!mt-2 !w-full !rounded-xl !border-slate-200 !px-3.5 !py-3 !text-sm focus:!border-indigo-400 focus:!ring-4 focus:!ring-indigo-50"
                  />
                </label>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-slate-400">
                    {changed
                      ? "Ada perubahan yang belum disimpan."
                      : "Pengaturan rekening tersimpan."}
                  </span>
                  <button
                    type="submit"
                    disabled={!!busy || !changed}
                    className="primary !flex !items-center !justify-center !gap-2 !rounded-xl !px-5 !py-3 !text-sm disabled:!opacity-50"
                  >
                    {busy === "account" ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}
                    {busy === "account" ? "Menyimpan…" : "Simpan rekening"}
                  </button>
                </div>
              </fieldset>
            </form>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <QrCode
                  size={21}
                  strokeWidth={1.7}
                  className="text-indigo-600"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="!mb-0 !text-base font-semibold text-slate-900">
                    QR pembayaran
                  </h2>
                  <p className="!mb-0 !mt-1 !text-xs text-slate-500">
                    Opsional. Toko tetap perlu memeriksa pembayaran.
                  </p>
                </div>
              </div>
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-1.5">
                    <img
                      src={qrUrl || "/payment-qr-placeholder.svg"}
                      alt={
                        qrUrl
                          ? "QR pembayaran toko"
                          : "Contoh QR yang belum dapat dibayar"
                      }
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="!mb-1 !text-sm font-medium text-slate-800">
                      {qrUrl ? "QR toko sudah tersedia" : "Belum ada QR toko"}
                    </p>
                    <p className="!mb-0 !text-xs leading-relaxed text-slate-500">
                      Unggah JPG, PNG, atau WebP maksimal 8 MB. Pastikan QR
                      sesuai rekening dan nama toko.
                    </p>
                    {!qrUrl && (
                      <p className="!mb-0 !mt-2 !text-[11px] font-medium text-amber-700">
                        Contoh QR · belum dapat dibayar
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <label
                    htmlFor={uploadId}
                    aria-disabled={!!busy || changed}
                    className={`secondary !relative !flex !cursor-pointer !items-center !justify-center !gap-2 !rounded-xl !px-4 !py-2.5 !text-xs focus-within:!ring-4 focus-within:!ring-indigo-100 ${busy || changed ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {busy === "qr" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    {busy === "qr"
                      ? "Mengunggah…"
                      : qrUrl
                        ? "Ganti QR pembayaran"
                        : "Unggah QR pembayaran"}
                    <input
                      id={uploadId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!!busy || changed}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void updateQr(file);
                      }}
                    />
                  </label>
                  {qrUrl && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void updateQr()}
                      className="!flex !items-center !justify-center !gap-2 !rounded-xl !border !border-red-100 !bg-white !px-4 !py-2.5 !text-xs !font-medium !text-red-600 hover:!bg-red-50 disabled:!opacity-50"
                    >
                      {busy === "remove" ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      {busy === "remove" ? "Menghapus…" : "Hapus QR"}
                    </button>
                  )}
                </div>
                <p className="!mb-0 !mt-3 !text-[11px] text-slate-400">
                  {changed
                    ? "Simpan perubahan rekening terlebih dahulu sebelum mengunggah QR."
                    : "QR baru langsung tampil setelah diunggah."}
                </p>
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm xl:sticky xl:top-6">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <span className="text-xs font-medium text-slate-500">
                  Pratinjau pelanggan
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-slate-400"
                  aria-hidden="true"
                />
              </div>
              <div className="px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Building2 size={23} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="!mb-0 !text-base font-semibold">
                      Transfer {account.bankName || "bank"}
                    </h3>
                    <p className="!mb-0 !mt-1 !text-[11px] text-slate-500">
                      D’Fable {branches[branchId]}
                    </p>
                  </div>
                </div>
                <div className="my-5 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-4">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                    Nomor rekening
                  </span>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <strong className="min-w-0 break-all text-xl font-bold tracking-wide text-indigo-950 tabular-nums">
                      {account.accountNumber || "Belum diatur"}
                    </strong>
                    <button
                      type="button"
                      aria-label="Salin nomor rekening pratinjau"
                      disabled={!account.accountNumber}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-white text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-40"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            account.accountNumber,
                          );
                          setCopied(true);
                        } catch {
                          setError(
                            "Nomor belum bisa disalin. Salin langsung dari kolom rekening.",
                          );
                        }
                      }}
                    >
                      {copied ? <Check size={17} /> : <Copy size={17} />}
                    </button>
                  </div>
                  <p className="!mb-0 !mt-2 break-words !text-xs text-indigo-700">
                    a.n. {account.accountHolder || "Nama pemilik rekening"}
                  </p>
                  {copied && (
                    <span
                      className="mt-2 block text-[11px] font-medium text-indigo-600"
                      role="status"
                    >
                      Nomor rekening disalin.
                    </span>
                  )}
                </div>
                <div className="mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border border-slate-100 bg-white p-2">
                  <img
                    src={qrUrl || "/payment-qr-placeholder.svg"}
                    alt={
                      qrUrl
                        ? "Pratinjau QR pembayaran pelanggan"
                        : "Contoh QR, bukan kode pembayaran"
                    }
                    className="h-full w-full object-contain"
                  />
                </div>
                {!qrUrl && (
                  <p className="!mb-0 !mt-3 text-center !text-[11px] font-semibold text-amber-700">
                    Contoh QR · belum dapat dibayar
                  </p>
                )}
                <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <p className="!mb-0 !text-[11px] leading-relaxed text-slate-500">
                    Pelanggan mengunggah bukti transfer. Toko memeriksa
                    pembayaran sebelum status berubah menjadi lunas.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {!!saved && error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
    </section>
  );
}
