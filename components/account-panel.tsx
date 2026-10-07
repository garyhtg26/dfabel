"use client";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  LogOut,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  Waves,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "./auth-provider";
export default function AccountPanel({
  onDone,
  phone = "",
  admin = false,
}: {
  onDone?: () => void;
  phone?: string;
  admin?: boolean;
}) {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "auth/operation-not-allowed"
          ? "Metode login ini belum diaktifkan di Firebase Authentication."
          : code === "auth/email-already-in-use"
            ? "Email sudah terdaftar. Silakan masuk atau atur ulang password."
            : code === "auth/unauthorized-domain"
              ? "Domain ini belum diizinkan untuk login."
              : code === "auth/too-many-requests"
                ? "Terlalu banyak percobaan. Coba kembali beberapa saat lagi."
                : code === "auth/popup-closed-by-user"
                  ? "Login Google dibatalkan."
                  : code === "auth/unauthorized-continue-uri"
                    ? "Domain aplikasi belum ditambahkan ke Authorized domains Firebase."
                    : "Belum berhasil. Periksa email, password, dan koneksi kamu.",
      );
    } finally {
      setBusy(false);
    }
  }
  const signedIn =
    auth.user && auth.verified && (!admin || auth.provider === "password");
  return (
    <div className="auth-panel">
      <p className="auth-kicker">
        D’FABLE {admin ? "WORKSPACE" : "LAUNDRY STUDIO"}
      </p>
      <h2>
        {signedIn
          ? `Halo, ${auth.user?.displayName?.split(" ")[0] || "teman D’Fable"}.`
          : auth.user && !auth.verified
            ? "Cek email kamu."
            : mode === "register"
              ? "Daftar akun"
              : mode === "reset"
                ? "Reset password"
                : admin
                  ? "Masuk dashboard"
                  : "Masuk akun"}
      </h2>
      {(signedIn || (auth.user && !auth.verified) || mode === "reset") && (
        <p className="auth-subtitle">
          {signedIn
            ? auth.user?.email
            : auth.user && !auth.verified
              ? `Verifikasi ${auth.user.email} untuk melanjutkan.`
              : "Tautan reset akan dikirim ke email kamu."}
        </p>
      )}
      {auth.user && !auth.verified ? (
        <div className="auth-form">
          <div className="verify-envelope" aria-hidden="true">
            <span className="verify-orbit" />
            <Mail size={36} />
            <span className="verify-seal">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="verify-instructions">
            <b>Satu klik untuk mengaktifkan akun.</b>
            <p>
              Buka email dari D’Fable Laundry Studio dan pilih tombol
              verifikasi. Halaman ini akan memperbarui status secara otomatis.
            </p>
            <small>Belum terlihat? Periksa folder spam atau promosi.</small>
          </div>
          <button
            className="primary full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (await auth.refresh()) onDone?.();
                else
                  setNotice(
                    "Email belum terverifikasi. Klik tautan di email, lalu coba lagi.",
                  );
              })
            }
          >
            <CheckCircle2 size={18} /> Saya sudah verifikasi
          </button>
          <button
            className="auth-link"
            disabled={busy || cooldown > 0}
            onClick={() =>
              run(async () => {
                await auth.verifyEmail();
                setCooldown(60);
                setNotice(
                  "Email verifikasi dikirim. Periksa juga folder spam.",
                );
              })
            }
          >
            {cooldown
              ? `Kirim ulang dalam ${cooldown} detik`
              : "Kirim ulang email verifikasi"}
          </button>
          <button className="auth-link" onClick={() => run(auth.logout)}>
            Gunakan akun lain
          </button>
        </div>
      ) : signedIn ? (
        <div className="auth-form">
          {!admin && (
            <div className="auth-profile">
              <Mail size={18} />
              <span>
                WhatsApp <b>{phone || "Diisi saat pemesanan pertama"}</b>
              </span>
            </div>
          )}
          <button className="primary full" onClick={onDone}>
            Lanjutkan <ArrowRight size={18} />
          </button>
          <button
            className="auth-link"
            onClick={() =>
              run(async () => {
                await auth.logout();
                onDone?.();
              })
            }
          >
            <LogOut size={16} /> Keluar akun
          </button>
        </div>
      ) : (
        <>
          {!admin && mode !== "reset" && (
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Daftar baru
              </button>
            </div>
          )}
          {admin && auth.user && (
            <p className="auth-notice">
              Sesi Google tidak berlaku untuk dashboard. Masuk ulang menggunakan
              password.
            </p>
          )}
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (mode === "reset") {
                  await auth.resetPassword(email.trim());
                  setNotice(
                    "Jika email terdaftar, tautan pengaturan password akan dikirim.",
                  );
                } else if (mode === "register") {
                  await auth.register(name.trim(), email.trim(), password);
                  setCooldown(60);
                  setPassword("");
                } else {
                  await auth.loginEmail(email.trim(), password);
                  setPassword("");
                  if (await auth.refresh()) onDone?.();
                }
              });
            }}
          >
            {mode === "register" && (
              <label>
                Nama lengkap
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="Nama kamu"
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </label>
            {mode !== "reset" && (
              <label>
                Password
                <div className="auth-password">
                  <input
                    type={show ? "text" : "password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    maxLength={128}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "register"
                        ? "Minimal 8 karakter"
                        : "Masukkan password"
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Sembunyikan password" : "Tampilkan password"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="auth-link auth-forgot"
                onClick={() => setMode("reset")}
              >
                Lupa / belum punya password?
              </button>
            )}
            <button
              className="primary full"
              disabled={busy || !auth.configured}
            >
              {busy
                ? "Sebentar…"
                : mode === "register"
                  ? "Buat akun"
                  : mode === "reset"
                    ? "Kirim tautan password"
                    : "Masuk"}
              <ArrowRight size={18} />
            </button>
          </form>
          {mode === "reset" ? (
            <button
              className="auth-link full"
              onClick={() => {
                setMode("login");
                setNotice("");
              }}
            >
              Kembali ke login
            </button>
          ) : (
            !admin && (
              <>
                <div className="auth-divider">
                  <span>atau lanjutkan dengan</span>
                </div>
                <button
                  className="auth-google"
                  disabled={busy || !auth.configured}
                  onClick={() =>
                    run(async () => {
                      await auth.login();
                      onDone?.();
                    })
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.7 0 5-1 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.2H3.1v2.6A10 10 0 0 0 12 22Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"
                    />
                  </svg>
                  Google
                </button>
              </>
            )
          )}
        </>
      )}
      {!auth.configured && (
        <p className="auth-notice">
          Login tersedia setelah konfigurasi Firebase diisi.
        </p>
      )}
      {notice && (
        <p role="status" className="auth-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <p className="auth-footer">
        <ShieldCheck size={13} /> Akun aman. Laundry nyaman.
      </p>
    </div>
  );
}
