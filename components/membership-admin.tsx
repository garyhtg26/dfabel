"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock3, ImageIcon, RefreshCw } from "lucide-react";
import { money } from "@/lib/types";
import { useAuth } from "./auth-provider";
import "./membership-admin.css";

type Deposit = {
  uid: string;
  requestId: string;
  amount: number;
  name: string;
  senderName: string;
  branchId: string;
  createdAt: string;
  hasProof?: boolean;
  bank: { bankName: string; accountNumber: string };
};

function DepositItem({
  item,
  busy,
  onReview,
}: {
  item: Deposit;
  busy: boolean;
  onReview: (item: Deposit, action: "confirm" | "reject") => void;
}) {
  const auth = useAuth();
  const [showProof, setShowProof] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofLoading, setProofLoading] = useState(false);
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);

  useEffect(() => {
    setProofUrl("");
    setProofError("");
    if (!showProof || !item.hasProof) return;
    const controller = new AbortController();
    let url = "";
    setProofLoading(true);
    const query = new URLSearchParams({
      uid: item.uid,
      requestId: item.requestId,
    });
    void auth
      .request(`/api/admin/membership/proof?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setProofUrl(url);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setProofError("Bukti belum bisa dimuat. Tutup dan coba lagi.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setProofLoading(false);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [auth.request, item.hasProof, item.requestId, item.uid, showProof]);

  return (
    <article className="membership-review-item">
      <div className="membership-review-head">
        <div>
          <span className="membership-review-status">
            <Clock3 size={14} /> Menunggu verifikasi
          </span>
          <h3>{item.name}</h3>
          <p>Pengirim: {item.senderName}</p>
        </div>
        <strong>{money(item.amount)}</strong>
      </div>
      <div className="membership-review-meta">
        <span>{item.branchId === "bogor" ? "Cibubur" : "Cinere"}</span>
        <span>
          {item.bank.bankName} · {item.bank.accountNumber}
        </span>
        <span>
          {new Date(item.createdAt).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>
      <div className="membership-review-actions">
        {item.hasProof ? (
          <button
            type="button"
            className="secondary"
            aria-expanded={showProof}
            onClick={() => setShowProof((current) => !current)}
          >
            <ImageIcon size={16} />{" "}
            {showProof ? "Sembunyikan bukti" : "Lihat bukti"}
          </button>
        ) : (
          <span className="membership-review-no-proof">
            Tidak ada bukti pada pengajuan ini
          </span>
        )}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => setAction("confirm")}
        >
          Verifikasi transfer
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setAction("reject")}
        >
          Tolak
        </button>
      </div>
      {showProof && item.hasProof && (
        <div className="membership-review-proof">
          {proofLoading && <p role="status">Memuat bukti transfer…</p>}
          {proofError && <p role="alert">{proofError}</p>}
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Buka bukti transfer ${item.name}`}
            >
              <img src={proofUrl} alt={`Bukti transfer ${item.name}`} />
            </a>
          )}
        </div>
      )}
      {action && (
        <div
          className="membership-review-confirm"
          role="group"
          aria-label="Konfirmasi pemeriksaan deposit"
        >
          <b>
            {action === "confirm"
              ? `Sudah cocokkan transfer ${money(item.amount)}?`
              : "Tolak pengajuan deposit ini?"}
          </b>
          <p>
            {action === "confirm"
              ? "Pastikan nominal dan nama pengirim sesuai mutasi rekening. Saldo akan ditambahkan ke akun pelanggan."
              : "Pelanggan dapat mengajukan kembali setelah pengajuan ini ditolak."}
          </p>
          <div>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => onReview(item, action)}
            >
              {busy
                ? "Memproses…"
                : action === "confirm"
                  ? "Ya, transfer diterima"
                  : "Ya, tolak pengajuan"}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function MembershipAdmin() {
  const auth = useAuth();
  const [items, setItems] = useState<Deposit[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await auth.request("/api/admin/membership");
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "Pengajuan belum bisa dimuat.");
    setItems(body.requests);
  }, [auth.request]);
  useEffect(() => {
    let active = true;
    void load()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function review(item: Deposit, action: "confirm" | "reject") {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await auth.request("/api/admin/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: item.uid,
          requestId: item.requestId,
          action,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error || "Pengajuan belum bisa diproses.");
      await load();
      setMessage(
        action === "confirm"
          ? "Deposit diverifikasi. Saldo sudah ditambahkan."
          : "Pengajuan deposit ditolak.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel membership-review">
      <header className="membership-review-title">
        <div>
          <span className="membership-review-kicker">MEMBERSHIP</span>
          <h2>Deposit pelanggan</h2>
          <p>Periksa bukti dan mutasi sebelum menambahkan saldo.</p>
        </div>
        <button
          type="button"
          className="membership-review-refresh"
          onClick={() => void refresh()}
          disabled={loading || busy}
          aria-label="Muat ulang deposit"
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {message && (
        <p className="membership-review-message" role="status">
          <BadgeCheck size={17} /> {message}
        </p>
      )}
      {error && (
        <p className="membership-review-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="membership-review-empty" role="status">
          Memuat pengajuan…
        </p>
      ) : items.length === 0 ? (
        <p className="membership-review-empty">
          Belum ada deposit yang menunggu verifikasi.
        </p>
      ) : (
        <div className="membership-review-list">
          <p className="membership-review-count">
            {items.length} menunggu verifikasi
          </p>
          {items.map((item) => (
            <DepositItem
              key={item.requestId}
              item={item}
              busy={busy}
              onReview={(record, action) => void review(record, action)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
