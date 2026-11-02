"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Coins } from "lucide-react";
import { money, type TrackingOrder } from "@/lib/types";
import { useAuth } from "./auth-provider";
import "./loyalty-redemption.css";

export default function LoyaltyRedemption({
  order,
  onChanged,
}: {
  order: TrackingOrder;
  onChanged?: () => void;
}) {
  const auth = useAuth();
  const pointsInputId = useId();
  const [balance, setBalance] = useState<number | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [points, setPoints] = useState(String(order.pointsUsed || ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    const response = await auth.request("/api/loyalty");
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!Number.isSafeInteger(data.balance) || data.balance < 0) throw Error();
    setBalance(data.balance);
    setReconciliationRequired(data.reconciliationRequired === true);
    setLoadError(false);
  }, [auth.request]);
  useEffect(() => {
    let active = true;
    void load().catch(() => {
      if (active) setLoadError(true);
    });
    return () => {
      active = false;
    };
  }, [auth.user?.uid, load]);
  useEffect(() => {
    setPoints(String(order.pointsUsed || ""));
  }, [order.id, order.pointsUsed]);
  const locked =
    order.paid ||
    !!order.paymentReconciliationRequired ||
    ["creating", "pending", "paid"].includes(order.payment?.status || "") ||
    ["awaiting_review", "paid"].includes(order.manualPayment?.status || "");
  const ready = order.actualKg !== null && order.shippingFee !== null;
  const used = order.pointsUsed || 0;
  const max =
    balance === null || !ready
      ? 0
      : Math.max(
          0,
          Math.min(
            balance + used,
            order.total -
              (order.shippingFee || 0) -
              (order.insurance ? 1000 : 0) +
              used,
          ),
        );
  async function apply(value: number) {
    setBusy(true);
    setMessage("");
    try {
      const response = await auth.request("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, points: value }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Poin belum bisa digunakan.");
      setBalance(data.balance);
      setPoints(value ? String(value) : "");
      setMessage(
        value
          ? "Poin berhasil mengurangi tagihan."
          : "Poin dikembalikan ke saldo.",
      );
      onChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Poin belum bisa digunakan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="loyalty-use" aria-label="Gunakan poin D’Fable">
      <div className="loyalty-use-heading">
        <span className="loyalty-use-icon">
          <Coins size={19} aria-hidden="true" />
        </span>
        <div>
          <h4>Gunakan poin</h4>
          <p>
            {balance === null
              ? "Memuat saldo poin…"
              : `Saldo ${balance.toLocaleString("id-ID")} poin · ${money(balance)}`}
          </p>
        </div>
      </div>
      {used > 0 && (
        <p className="loyalty-use-applied">Potongan poin: −{money(used)}</p>
      )}
      {loadError && (
        <p className="loyalty-use-note" role="alert">
          Saldo poin belum bisa dimuat.{" "}
          <button
            type="button"
            onClick={() => void load().catch(() => setLoadError(true))}
          >
            Coba lagi
          </button>
        </p>
      )}
      {reconciliationRequired && (
        <p className="loyalty-use-note">
          Poin sedang diperiksa toko. Hubungi toko untuk bantuan.
        </p>
      )}
      {!reconciliationRequired && order.paid && (
        <p className="loyalty-use-note">
          Pesanan ini sudah lunas. Poin dapat digunakan untuk pesanan
          berikutnya.
        </p>
      )}
      {!reconciliationRequired && !order.paid && locked && (
        <p className="loyalty-use-note">
          Pembayaran sedang diproses. Poin tidak dapat diubah sampai pemeriksaan
          selesai.
        </p>
      )}
      {!reconciliationRequired && !locked && !ready && (
        <p className="loyalty-use-note">
          Poin bisa digunakan setelah toko memastikan berat dan ongkir. Kembali
          ke halaman ini sebelum membayar.
        </p>
      )}
      {!reconciliationRequired &&
        !locked &&
        ready &&
        balance === 0 &&
        !used && (
          <p className="loyalty-use-note">
            Belum ada poin yang dapat digunakan. Poin dari pesanan lunas akan
            masuk ke akunmu.
          </p>
        )}
      {!reconciliationRequired &&
        !locked &&
        ready &&
        balance !== null &&
        balance > 0 &&
        max === 0 &&
        !used && (
          <p className="loyalty-use-note">
            Biaya layanan sudah terpotong seluruhnya. Poin tidak berlaku untuk
            ongkir atau perlindungan cucian.
          </p>
        )}
      {order.manualPayment?.hasProof && !locked && (
        <p className="loyalty-use-note">
          Jika poin diubah, bukti transfer perlu diunggah ulang.
        </p>
      )}
      {ready &&
        !locked &&
        !reconciliationRequired &&
        balance !== null &&
        (max > 0 || used > 0) && (
          <div className="loyalty-use-controls">
            <label htmlFor={pointsInputId}>
              Jumlah poin <small>1 poin = Rp1</small>
            </label>
            <div className="loyalty-use-input-row">
              <input
                id={pointsInputId}
                type="number"
                inputMode="numeric"
                min="0"
                max={max}
                step="1"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
                placeholder="Masukkan poin"
              />
              <button
                type="button"
                className="loyalty-use-apply"
                disabled={
                  busy ||
                  points === "" ||
                  !Number.isSafeInteger(Number(points)) ||
                  Number(points) < 0 ||
                  Number(points) > max
                }
                onClick={() => void apply(Number(points))}
              >
                {busy ? "Memproses…" : "Gunakan"}
              </button>
            </div>
            <div className="loyalty-use-actions">
              <button
                type="button"
                disabled={busy || max === 0}
                onClick={() => void apply(max)}
              >
                Gunakan maksimal {max.toLocaleString("id-ID")} poin
              </button>
              {used > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apply(0)}
                >
                  Batalkan
                </button>
              )}
            </div>
            <p className="loyalty-use-hint">
              Poin mengurangi biaya layanan, di luar ongkir dan perlindungan
              cucian.
            </p>
          </div>
        )}
      {message && (
        <p role="status" className="loyalty-use-message">
          {message}
        </p>
      )}
    </section>
  );
}
