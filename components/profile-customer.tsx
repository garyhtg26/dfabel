"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import CustomerAccount from "./customer-account";
import "./profile-customer.css";

type Profile = { name: string; phone: string; email: string };
type PointEntry = {
  id: string;
  type: "earned" | "redeemed" | "returned";
  points: number;
  orderId: string;
  createdAt: string;
};
type Loyalty = {
  balance: number;
  history: PointEntry[];
  reconciliationRequired?: boolean;
};

const formatPoints = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);
const formatDate = (date: string) => {
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? ""
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(value);
};

export default function CustomerProfile() {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [points, setPoints] = useState<Loyalty | null>(null);
  const [profileError, setProfileError] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedUser, setLoadedUser] = useState("");

  useEffect(() => {
    if (!auth.user || !auth.verified) return;
    const controller = new AbortController();
    setProfile(null);
    setPoints(null);
    setProfileError("");
    setPointsError("");
    const uid = auth.user.uid;
    const read = async (url: string) => {
      const response = await auth.request(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Data belum bisa dimuat.");
      return body;
    };
    void read("/api/profile")
      .then((body) => {
        if (controller.signal.aborted) return;
        const data = body.profile as Profile;
        setProfile(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setLoadedUser(uid);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setProfileError(error.message || "Profil belum bisa dimuat.");
          setLoadedUser(uid);
        }
      });
    void read("/api/loyalty")
      .then((body) => {
        if (!controller.signal.aborted) setPoints(body as Loyalty);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPointsError(error.message || "Poin belum bisa dimuat.");
      });
    return () => controller.abort();
  }, [auth.user?.uid, auth.verified, auth.request, reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setProfileError("");
    setNotice("");
    try {
      const response = await auth.request("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Profil belum bisa disimpan.");
      setProfile((current) =>
        current
          ? {
              ...current,
              name: name.trim(),
              phone: body.profile?.phone ?? phone,
            }
          : current,
      );
      if (body.profile?.phone != null) setPhone(body.profile.phone);
      await auth.refresh().catch(() => false);
      setNotice("Data diri berhasil disimpan.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Profil belum bisa disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    auth.loading ||
    (auth.user && auth.verified && loadedUser !== auth.user.uid)
  )
    return (
      <main className="loading">
        <div
          className="loading-progress"
          role="progressbar"
          aria-label="Memuat profil"
        >
          <span />
        </div>
      </main>
    );
  if (!auth.user || !auth.verified)
    return (
      <main className="profile-gate">
        <Link className="profile-brand" href="/">
          <img src="/dfable-logo.png" alt="D’Fable Laundry Studio" />
        </Link>
        <span className="profile-gate-icon">
          <UserRound size={27} />
        </span>
        <h1>
          {auth.user ? "Verifikasi akun dulu" : "Masuk untuk melihat profil"}
        </h1>
        <p>
          {auth.user
            ? "Selesaikan verifikasi email untuk melihat data dan poin kamu."
            : "Data diri dan poin kamu ada di sini setelah masuk."}
        </p>
        <Link className="primary" href="/?account=1">
          {auth.user ? "Verifikasi akun" : "Masuk"}
        </Link>
      </main>
    );

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link href="/" className="profile-brand" aria-label="D’Fable beranda">
          <img src="/dfable-logo.png" alt="D’Fable Laundry Studio" />
        </Link>
        <Link className="profile-back" href="/">
          <ArrowLeft size={17} /> <span>Kembali ke beranda</span>
        </Link>
        <CustomerAccount onLogin={() => {}} />
      </header>
      <div className="profile-content">
        <div className="profile-title">
          <span>AKUN SAYA</span>
          <h1>Profil saya</h1>
          <p>Kelola data diri dan lihat poin yang kamu punya.</p>
        </div>
        <div className="profile-layout">
          <section className="profile-panel profile-details">
            <div className="profile-panel-heading">
              <span className="profile-panel-icon">
                <UserRound size={22} />
              </span>
              <div>
                <h2>Data diri</h2>
                <p>Informasi untuk pesananmu.</p>
              </div>
            </div>
            {profile ? (
              <form onSubmit={save}>
                <label>
                  Nama lengkap
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  Nomor WhatsApp
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="Contoh: 0812 3456 7890"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                  <small>Digunakan untuk menghubungi kamu soal pesanan.</small>
                </label>
                <label>
                  Email{" "}
                  <span className="profile-locked">
                    <LockKeyhole size={13} /> Tidak dapat diubah
                  </span>
                  <input value={profile.email} readOnly autoComplete="email" />
                </label>
                {profileError && (
                  <p className="profile-error" role="alert">
                    {profileError}
                  </p>
                )}
                {notice && (
                  <p className="profile-notice" role="status">
                    {notice}
                  </p>
                )}
                <button className="primary" type="submit" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              </form>
            ) : profileError ? (
              <div className="profile-retry">
                <p role="alert">{profileError}</p>
                <button
                  className="secondary"
                  onClick={() => setReload((value) => value + 1)}
                >
                  Coba lagi
                </button>
              </div>
            ) : (
              <p className="profile-loading" role="status">
                Memuat data diri…
              </p>
            )}
          </section>
          <div className="profile-points-column">
            <section className="profile-points-card">
              <div className="profile-points-top">
                <span>
                  <Gift size={20} /> POIN D’FABLE
                </span>
                <span>LOYALTY</span>
              </div>
              <p>Poin kamu</p>
              <strong>
                {points ? formatPoints(points.balance) : "—"}{" "}
                <small>poin</small>
              </strong>
              <div className="profile-points-foot">
                Dapatkan poin 10% dari biaya layanan setelah potongan poin,
                ketika pembayaran dikonfirmasi. 1 poin = Rp1 untuk pesanan
                berikutnya.
              </div>
              {points?.reconciliationRequired && (
                <p role="status">
                  Poin sedang diperiksa toko. Hubungi toko untuk bantuan.
                </p>
              )}
            </section>
            <section className="profile-panel profile-history">
              <div className="profile-history-heading">
                <div>
                  <h2>Riwayat poin</h2>
                  <p>Perubahan poin dari pesananmu.</p>
                </div>
                <Gift size={20} />
              </div>
              {pointsError ? (
                <div className="profile-retry">
                  <p role="alert">{pointsError}</p>
                  <button
                    className="secondary"
                    onClick={() => setReload((value) => value + 1)}
                  >
                    Coba lagi
                  </button>
                </div>
              ) : !points ? (
                <p className="profile-loading" role="status">
                  Memuat poin…
                </p>
              ) : points.history.length ? (
                <ul>
                  {points.history.map((item) => (
                    <li key={item.id}>
                      <span
                        className={`profile-history-icon ${item.type === "redeemed" ? "redeemed" : ""}`}
                      >
                        {item.type === "redeemed" ? (
                          <ArrowUpRight size={19} />
                        ) : (
                          <ArrowDownLeft size={19} />
                        )}
                      </span>
                      <span className="profile-history-copy">
                        <b>
                          {item.type === "earned"
                            ? "Poin dari pesanan"
                            : item.type === "returned"
                              ? "Poin dikembalikan"
                              : "Poin digunakan"}
                        </b>
                        <small>
                          {item.orderId}{" "}
                          {formatDate(item.createdAt) &&
                            `· ${formatDate(item.createdAt)}`}
                        </small>
                      </span>
                      <strong
                        className={item.type === "redeemed" ? "redeemed" : ""}
                      >
                        {item.type === "redeemed" ? "−" : "+"}
                        {formatPoints(item.points)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="profile-empty">
                  <Gift size={23} />
                  <b>Belum ada riwayat poin</b>
                  <span>
                    Poin dari pesanan yang dibayar akan muncul di sini.
                  </span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
