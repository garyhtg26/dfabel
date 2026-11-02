"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { money, type TrackingOrder } from "@/lib/types";
import { useAuth } from "./auth-provider";

export default function LoyaltyRedemption({
  order,
  onChanged,
}: {
  order: TrackingOrder;
  onChanged?: () => void;
}) {
  const auth = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [points, setPoints] = useState(String(order.pointsUsed || ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    auth
      .request("/api/loyalty")
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (active && Number.isSafeInteger(data.balance) && data.balance >= 0) {
          setBalance(data.balance);
          setReconciliationRequired(data.reconciliationRequired === true);
        }
      })
      .catch(() => {
        if (active) setMessage("Poin belum bisa dimuat. Coba lagi nanti.");
      });
    return () => {
      active = false;
    };
  }, [auth.user?.uid, auth.request]);
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
            order.total - (order.shippingFee || 0) + used,
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
      setMessage(
        value ? "Poin berhasil digunakan." : "Poin dikembalikan ke saldo.",
      );
      onChanged?.();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"
      aria-label="Poin loyalty"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-white p-2 text-indigo-600">
          <Coins size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="!mb-1 text-sm font-bold text-slate-800">
            Poin D’Fable
          </h4>
          <p className="!mb-0 text-xs text-slate-600">
            {balance === null
              ? "Memuat saldo…"
              : `Saldo ${balance.toLocaleString("id-ID")} poin · ${money(balance)}`}
          </p>
        </div>
      </div>
      {used > 0 && (
        <p className="!mb-0 !mt-3 text-xs font-semibold text-indigo-700">
          Potongan digunakan: {used.toLocaleString("id-ID")} poin ({money(used)}
          )
        </p>
      )}
      {reconciliationRequired && (
        <p className="!mb-0 !mt-3 text-xs text-amber-800">
          Poin sedang diperiksa toko. Hubungi toko untuk bantuan.
        </p>
      )}
      {order.manualPayment?.hasProof && !locked && (
        <p className="!mb-0 !mt-3 text-xs text-amber-800">
          Jika jumlah poin diubah, kamu perlu mengunggah ulang bukti transfer.
        </p>
      )}
      {!ready && !order.paid && (
        <p className="!mb-0 !mt-3 text-xs text-slate-600">
          Poin bisa dipakai setelah toko mengonfirmasi jumlah cucian dan ongkir.
        </p>
      )}
      {ready &&
        !locked &&
        !reconciliationRequired &&
        balance !== null &&
        (max > 0 || used > 0) && (
          <div className="mt-3">
            <label className="!mb-2 text-xs">
              Poin yang digunakan
              <input
                aria-label="Jumlah poin yang digunakan"
                className="!mt-1"
                type="number"
                min="0"
                max={max}
                step="1"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="secondary"
                disabled={busy || max === 0}
                onClick={() => {
                  setPoints(String(max));
                  void apply(max);
                }}
              >
                Pakai {max.toLocaleString("id-ID")} poin
              </button>
              <button
                type="button"
                className="secondary"
                disabled={
                  busy ||
                  !Number.isSafeInteger(Number(points)) ||
                  Number(points) < 0 ||
                  Number(points) > max ||
                  points === ""
                }
                onClick={() => void apply(Number(points))}
              >
                Simpan
              </button>
              {used > 0 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => void apply(0)}
                >
                  Batalkan poin
                </button>
              )}
            </div>
          </div>
        )}
      {locked && used > 0 && (
        <p className="!mb-0 !mt-2 text-xs text-slate-600">
          Poin terkunci selama pembayaran diperiksa atau sudah lunas.
        </p>
      )}
      {message && (
        <p role="status" className="!mb-0 !mt-3 text-xs text-indigo-800">
          {message}
        </p>
      )}
    </section>
  );
}
