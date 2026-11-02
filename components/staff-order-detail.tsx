"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ExternalLink,
  Info,
  MapPin,
  MessageCircle,
  Printer,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { branches, isBranchId } from "@/lib/branches";
import { speedLabel, unitLabel } from "@/lib/catalog";
import { money, statuses, type Order, type Service } from "@/lib/types";
import { calculateOrderPrice, normalizePhone } from "@/lib/pricing";
import PaymentPanel from "./payment-panel";
import PaymentStatus from "./payment-status";
import { useAuth } from "./auth-provider";
import AuthorizedPhoto from "./authorized-photo";
import "./staff-order-detail.css";

const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
};
const statusMessages = [
  "Pesananmu sudah kami terima dan menunggu konfirmasi toko.",
  "Penjemputan cucianmu sudah dijadwalkan.",
  "Kurir sedang menuju lokasi untuk menjemput cucianmu.",
  "Cucianmu sudah tiba di toko dan sedang ditimbang.",
  "Cucianmu sedang dalam proses pencucian.",
  "Cucianmu sedang dalam tahap finishing dan pemeriksaan.",
  "Cucianmu sedang dalam perjalanan untuk diantar.",
  "Pesananmu sudah selesai. Terima kasih sudah memilih D’Fable!",
];

export default function StaffOrderDetail({
  order: o,
  services,
  busy,
  save,
  paymentEnabled,
  onPaymentChanged,
}: {
  order: Order;
  services: Service[];
  busy: boolean;
  save: (data: unknown) => Promise<void>;
  paymentEnabled?: boolean;
  onPaymentChanged: () => void;
}) {
  const auth = useAuth();
  const [cashConfirm, setCashConfirm] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);
  const [cashError, setCashError] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState(o.status);
  const [waStatus, setWaStatus] = useState<number | null>(null);
  useEffect(() => {
    setStatus(o.status);
    setWaStatus(null);
    setErr("");
    setNotice("");
  }, [o.id]);
  const service = services.find((item) => item.id === o.service);
  const unit = unitLabel(o.unit ?? service?.unit);
  const locked = Boolean(
    o.paid ||
    o.paymentReconciliationRequired ||
    (o.payment && ["creating", "pending", "paid"].includes(o.payment.status)) ||
    (o.manualPayment &&
      ["awaiting_review", "paid"].includes(o.manualPayment.status)),
  );
  const branch = isBranchId(o.branchId) ? branches[o.branchId] : o.branchId;
  const tracking =
    typeof window !== "undefined"
      ? `${window.location.origin}/?track=${encodeURIComponent(o.token)}`
      : "";
  const phone = normalizePhone(o.phone).replace(/\D/g, "");
  const messageStatus = waStatus ?? o.status;
  const statusMessage =
    o.source === "pos" && messageStatus < 4
      ? `Status pesananmu: ${statuses[messageStatus]}.`
      : statusMessages[messageStatus] ||
        `Status pesananmu: ${statuses[messageStatus]}.`;
  const message = `Halo ${o.name}, ${statusMessage}\n\nNomor pesanan: ${o.id}\nLacak pesananmu di sini: ${tracking}\n\nTerima kasih, D’Fable ${branch}`;
  const waUrl =
    phone && tracking
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : "";

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextStatus = Number(form.get("status"));
    const previousStatus = o.status;
    setErr("");
    setNotice("");
    try {
      await save({
        id: o.id,
        status: nextStatus,
        actualKg: Number(form.get("weight")),
        paid: o.paid,
        shippingFee:
          form.get("shipping") === "" ? null : Number(form.get("shipping")),
      });
      setNotice(
        nextStatus !== previousStatus
          ? "Status tersimpan. Kirim kabar ke pelanggan melalui WhatsApp."
          : "Perubahan tersimpan.",
      );
      if (nextStatus !== previousStatus) setWaStatus(nextStatus);
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Perubahan belum bisa disimpan.",
      );
    }
  }

  return (
    <div className="staff-detail">
      <div className="staff-detail-title">
        <div>
          <p className="staff-detail-kicker">
            PESANAN {o.source === "pos" ? "DATANG LANGSUNG" : "ONLINE"}
          </p>
          <h2>{o.id}</h2>
          <p className="staff-detail-meta">
            {branch} · {formatDate(o.createdAt)}
          </p>
        </div>
        <span className="staff-detail-status">{statuses[o.status]}</span>
      </div>
      <div className="staff-detail-grid">
        <div className="staff-detail-main">
          <section className="staff-detail-card">
            <div className="staff-detail-card-heading">
              <UserRound size={19} />
              <h3>Pelanggan & cucian</h3>
            </div>
            <div className="staff-detail-customer">
              <div>
                <b>{o.name}</b>
                <span>{o.phone}</span>
              </div>
              <div>
                <b>{service?.name || o.service}</b>
                <span>
                  {o.actualKg ?? o.kg} {unit}
                  {o.actualKg === null ? " · perkiraan" : ""} ·{" "}
                  {speedLabel(o.speed, o.express)}
                </span>
              </div>
            </div>
            {o.source === "web" && (
              <div className="staff-detail-address">
                <MapPin size={17} />
                <div>
                  {o.address}
                  <small>
                    {o.date} · {o.slot}
                  </small>
                  <a
                    href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka titik jemput <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}
            {o.source === "pos" && (
              <p className="staff-detail-note">
                Pelanggan datang langsung ke toko.
              </p>
            )}
            {o.insurance && (
              <p className="staff-detail-note">
                <Info size={16} /> Perlindungan cucian aktif · Rp1.000
              </p>
            )}
            {o.notes && (
              <p className="staff-detail-note">
                <Info size={16} /> {o.notes}
              </p>
            )}
            {o.photo && (
              <details className="staff-detail-photo">
                <summary>Lihat foto cucian</summary>
                <AuthorizedPhoto src={o.photo} />
              </details>
            )}
          </section>
          <form className="staff-detail-card staff-update" onSubmit={onSave}>
            <div className="staff-detail-card-heading">
              <ReceiptText size={19} />
              <h3>Perbarui pesanan</h3>
            </div>
            <label>
              Status cucian
              <select
                name="status"
                value={status}
                onChange={(event) => setStatus(Number(event.target.value))}
              >
                {statuses.map((label, i) => (
                  <option disabled={i < o.status} value={i} key={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-two">
              <label>
                {unit === "kg"
                  ? "Berat aktual (kg)"
                  : `Jumlah aktual (${unit})`}
                <input
                  required
                  name="weight"
                  type="number"
                  step={unit === "kg" ? "0.1" : "1"}
                  min={unit === "kg" ? "0.1" : "1"}
                  max="100"
                  defaultValue={o.actualKg ?? o.kg}
                  readOnly={locked}
                  aria-readonly={locked}
                />
                {o.actualKg === null && (
                  <small>Pastikan jumlah sebelum menyimpan tagihan.</small>
                )}
              </label>
              <label>
                Ongkir (Rp)
                <input
                  name="shipping"
                  type="number"
                  min="0"
                  max="10000000"
                  step="1000"
                  placeholder="Belum dikonfirmasi"
                  defaultValue={o.shippingFee ?? ""}
                  readOnly={locked}
                  aria-readonly={locked}
                />
                <small>Isi 0 jika gratis atau ambil di toko.</small>
              </label>
            </div>
            {locked && (
              <p className="staff-detail-lock">
                <ShieldCheck size={16} /> Tagihan terkunci karena pembayaran
                sedang diperiksa atau sudah lunas.
              </p>
            )}
            {err && (
              <p className="form-error" role="alert">
                {err}
              </p>
            )}
            {notice && (
              <p className="staff-detail-notice" role="status">
                {notice}
              </p>
            )}
            <button type="submit" disabled={busy} className="primary">
              {busy ? "Menyimpan…" : "Simpan perubahan"}
            </button>
          </form>
        </div>
        <aside className="staff-detail-side">
          <section className="staff-detail-card">
            <div className="staff-detail-card-heading">
              <ReceiptText size={19} />
              <h3>Tagihan</h3>
            </div>
            <PaymentStatus
              paid={o.paid}
              manualPayment={o.manualPayment}
              payment={o.payment}
              reviewRequired={o.paymentReconciliationRequired}
              compact={false}
            />
            <div className="staff-detail-total">
              <span>Total saat ini</span>
              <strong>{money(o.total)}</strong>
            </div>
            <p className="staff-detail-hint">
              Jumlah akhir dihitung setelah berat dan ongkir disimpan.
            </p>
          </section>
          <PaymentPanel
            orderId={o.id}
            trackingToken={o.token}
            enabled={paymentEnabled}
            initialPaid={o.paid}
            initialPayment={o.payment}
            initialReviewRequired={o.paymentReconciliationRequired}
            initialManualPayment={o.manualPayment}
            hideQrByDefault
            hideProofByDefault
            onChanged={onPaymentChanged}
          />
          {o.source === "pos" && !o.paid && !locked && (
            <div className="staff-detail-card">
              {!cashConfirm ? (
                <button
                  type="button"
                  className="secondary full"
                  onClick={() => setCashConfirm(true)}
                >
                  Terima pembayaran tunai
                </button>
              ) : (
                <>
                  <p className="staff-detail-hint">
                    Pastikan uang tunai {money(o.total)} sudah diterima.
                  </p>
                  {cashError && (
                    <p className="form-error" role="alert">
                      {cashError}
                    </p>
                  )}
                  <div className="staff-detail-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={cashBusy}
                      onClick={async () => {
                        setCashBusy(true);
                        setCashError("");
                        try {
                          const result = await auth.request("/api/pos/cash", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              orderId: o.id,
                              expectedTotal: o.total,
                            }),
                          });
                          const data = await result.json();
                          if (!result.ok) throw Error(data.error);
                          setCashConfirm(false);
                          setNotice("Pembayaran tunai dicatat lunas.");
                          onPaymentChanged();
                        } catch (error) {
                          setCashError(
                            error instanceof Error
                              ? error.message
                              : "Pembayaran belum disimpan.",
                          );
                        } finally {
                          setCashBusy(false);
                        }
                      }}
                    >
                      Ya, tunai sudah diterima
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setCashConfirm(false)}
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="staff-detail-actions">
            {waUrl && (
              <a
                className="staff-wa-button"
                href={waUrl}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={18} />{" "}
                {waStatus !== null
                  ? "Kirim pembaruan via WhatsApp"
                  : "Kabar pelanggan via WhatsApp"}
              </a>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              <Printer size={18} /> Cetak struk / PDF
            </button>
            {tracking && (
              <a
                className="text-button"
                href={tracking}
                target="_blank"
                rel="noreferrer"
              >
                Buka tracking pelanggan <ExternalLink size={14} />
              </a>
            )}
          </div>
        </aside>
      </div>
      <StaffReceipt order={o} services={services} />
    </div>
  );
}

export function StaffReceipt({
  order: o,
  services,
}: {
  order: Order;
  services: Service[];
}) {
  const service = services.find((item) => item.id === o.service);
  const unit = unitLabel(o.unit ?? service?.unit);
  const branch = isBranchId(o.branchId) ? branches[o.branchId] : o.branchId;
  const tracking =
    typeof window !== "undefined"
      ? `${window.location.origin}/?track=${encodeURIComponent(o.token)}`
      : "";
  const payment = o.paymentReconciliationRequired
    ? "Perlu pemeriksaan"
    : o.paid
      ? o.paymentMethod === "cash"
        ? "Lunas · Tunai"
        : o.paymentMethod === "points"
          ? "Lunas · Poin"
          : o.paymentMethod === "membership"
            ? "Lunas · Saldo membership"
            : "Lunas"
      : o.manualPayment?.status === "awaiting_review"
        ? "Perlu konfirmasi"
        : "Belum lunas";
  return (
    <div className="staff-receipt" aria-hidden="true">
      <h1>D’FABLE LAUNDRY STUDIO</h1>
      <p>Cabang {branch}</p>
      <h2>STRUK PESANAN</h2>
      <div className="staff-receipt-row">
        <span>No. pesanan</span>
        <b>{o.id}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Tanggal</span>
        <span>{formatDate(o.createdAt)}</span>
      </div>
      <div className="staff-receipt-row">
        <span>Pelanggan</span>
        <span>{o.name}</span>
      </div>
      <div className="staff-receipt-row">
        <span>WhatsApp</span>
        <span>{o.phone}</span>
      </div>
      <hr />
      <div className="staff-receipt-row">
        <span>Layanan</span>
        <b>{service?.name || o.service}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Jumlah</span>
        <span>
          {o.actualKg ?? o.kg} {unit}
          {o.actualKg === null ? " (perkiraan)" : ""}
        </span>
      </div>
      <div className="staff-receipt-row">
        <span>Pengerjaan</span>
        <span>{speedLabel(o.speed, o.express)}</span>
      </div>
      <div className="staff-receipt-row">
        <span>Biaya layanan</span>
        <span>{money(calculateOrderPrice(o, o.actualKg ?? o.kg))}</span>
      </div>
      {o.membershipDiscount && (
        <div className="staff-receipt-row">
          <span>Diskon membership</span>
          <span>20% sudah termasuk</span>
        </div>
      )}
      <div className="staff-receipt-row">
        <span>Ongkir</span>
        <span>
          {o.shippingFee === null ? "Belum dikonfirmasi" : money(o.shippingFee)}
        </span>
      </div>
      {o.insurance && (
        <div className="staff-receipt-row">
          <span>Perlindungan cucian</span>
          <span>{money(1000)}</span>
        </div>
      )}
      {!!o.membershipUsed && (
        <div className="staff-receipt-row">
          <span>Saldo membership</span>
          <span>−{money(o.membershipUsed)}</span>
        </div>
      )}
      {!!o.pointsUsed && (
        <div className="staff-receipt-row">
          <span>Potongan poin</span>
          <span>−{money(o.pointsUsed)}</span>
        </div>
      )}
      <hr />
      <div className="staff-receipt-row staff-receipt-total">
        <span>
          {o.actualKg === null || o.shippingFee === null ? "Estimasi" : "Total"}
        </span>
        <b>{money(o.total)}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Pembayaran</span>
        <b>{payment}</b>
      </div>
      <p>Lacak pesanan: {tracking}</p>
      <p>Terima kasih telah memilih D’Fable.</p>
    </div>
  );
}
