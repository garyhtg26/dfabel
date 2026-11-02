"use client";
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { money, type TrackingOrder } from "@/lib/types";
import { useAuth } from "./auth-provider";
export default function MembershipRedemption({
  order,
  onChanged,
}: {
  order: TrackingOrder;
  onChanged?: () => void;
}) {
  const auth = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState(String(order.membershipUsed || ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!order.membershipDiscount) return;
    let active = true;
    void auth
      .request("/api/membership")
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (active) setBalance(data.balance);
      })
      .catch(() => {
        if (active) setMessage("Saldo belum bisa dimuat.");
      });
    return () => {
      active = false;
    };
  }, [
    auth.request,
    order.membershipDiscount,
    order.membershipUsed,
    order.pointsUsed,
  ]);
  useEffect(
    () => setAmount(String(order.membershipUsed || "")),
    [order.membershipUsed, order.id],
  );
  if (!order.membershipDiscount) return null;
  const locked =
    order.paid ||
    !!order.paymentReconciliationRequired ||
    ["creating", "pending", "paid"].includes(order.payment?.status || "") ||
    ["awaiting_review", "paid"].includes(order.manualPayment?.status || "");
  const ready = order.actualKg !== null && order.shippingFee !== null;
  const used = order.membershipUsed || 0;
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
      const response = await auth.request("/api/membership/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, amount: value }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setBalance(data.balance);
      setAmount(String(value || ""));
      setMessage(value ? "Saldo membership digunakan." : "Saldo dikembalikan.");
      onChanged?.();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="flex items-center gap-2">
        <CreditCard size={19} />
        <b>Membership · diskon layanan 20%</b>
      </div>
      <p className="!mb-0 !mt-2">
        Saldo {balance === null ? "…" : money(balance)}
        {used ? ` · digunakan ${money(used)}` : ""}
      </p>
      {!ready && !order.paid && (
        <p className="!mb-0 !mt-2 text-xs">
          Saldo bisa digunakan setelah toko mengonfirmasi jumlah dan ongkir.
        </p>
      )}
      {ready && !locked && (max > 0 || used > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`member-${order.id}`}>
            Jumlah saldo yang digunakan
          </label>
          <input
            id={`member-${order.id}`}
            className="!w-36"
            type="number"
            min="0"
            max={max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            type="button"
            className="secondary"
            disabled={
              busy ||
              amount === "" ||
              !Number.isSafeInteger(Number(amount)) ||
              Number(amount) < 0 ||
              Number(amount) > max
            }
            onClick={() => void apply(Number(amount))}
          >
            Gunakan saldo
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || max === 0}
            onClick={() => void apply(max)}
          >
            Pakai {money(max)}
          </button>
          {used > 0 && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void apply(0)}
            >
              Batalkan
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="!mb-0 !mt-2">
          {message}
        </p>
      )}
    </section>
  );
}
