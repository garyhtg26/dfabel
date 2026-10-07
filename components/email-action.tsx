"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import {
  Check,
  ArrowRight,
  Mail,
  ShieldCheck,
  KeyRound,
  Loader2,
  Link2Off,
} from "lucide-react";
import { clientAuth } from "@/lib/firebase/client";
import { useAuth } from "./auth-provider";
export default function EmailAction({
  mode = "return",
  code = "",
}: {
  mode?: string;
  code?: string;
}) {
  const auth = useAuth();
  const started = useRef(false);
  const [state, setState] = useState<
    "loading" | "ready" | "success" | "invalid" | "return"
  >("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = mode === "resetPassword";
  const target = auth.scope === "admin" ? "/dashboard" : "/?account=1";
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (mode === "return") {
      setState("return");
      return;
    }
    if (!code || !["verifyEmail", "resetPassword"].includes(mode)) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        if (reset) {
          setEmail(await verifyPasswordResetCode(clientAuth(auth.scope), code));
        } else {
          const info = await checkActionCode(clientAuth(auth.scope), code);
          if (info.operation !== "VERIFY_EMAIL") throw Error();
          setEmail(info.data.email || "");
        }
        setState("ready");
      } catch {
        setState("invalid");
      }
    })();
  }, [mode, code, auth.scope, reset]);
  useEffect(() => {
    if (mode !== "return" || auth.loading) return;
    void auth
      .refresh()
      .then((verified) => {
        if (verified) setState("success");
      })
      .catch(() => {});
  }, [mode, auth.loading, auth.user?.uid]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (reset) {
        if (password.length < 8 || password !== confirmation) {
          setError(
            "Gunakan minimal 8 karakter dan pastikan kedua password sama.",
          );
          return;
        }
        await confirmPasswordReset(clientAuth(auth.scope), code, password);
        setPassword("");
        setConfirmation("");
      } else {
        await applyActionCode(clientAuth(auth.scope), code);
        await auth.refresh().catch(() => false);
      }
      setState("success");
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        code === "auth/weak-password" ||
        code === "auth/password-does-not-meet-requirements"
      )
        setError(
          "Password belum memenuhi ketentuan. Gunakan minimal 8 karakter.",
        );
      else setState("invalid");
    } finally {
      setBusy(false);
    }
  }
  const success = state === "success";
  const invalid = state === "invalid";
  return (
    <main className="email-page">
      <a href="/" className="email-brand" aria-label="D’Fable beranda">
        <Image
          src="/dfable-logo.png"
          width={190}
          height={58}
          alt="D’Fable Laundry Studio"
          priority
        />
      </a>
      <div className="email-layout">
        <aside className="email-story">
          <h1>Akun D’Fable</h1>
          <Image
            src="/laundry.png"
            width={1536}
            height={1024}
            alt="Pakaian bersih terlipat rapi"
            className="email-story-photo"
          />
          <span className="email-story-caption">D’FABLE · LAUNDRY STUDIO</span>
        </aside>
        <section className="email-card" aria-live="polite">
          <span className={`email-status-icon ${success ? "is-success" : ""}`}>
            {state === "loading" ? (
              <Loader2 className="spin" size={30} />
            ) : success ? (
              <Check size={32} />
            ) : invalid ? (
              <Link2Off size={30} />
            ) : reset ? (
              <KeyRound size={29} />
            ) : (
              <Mail size={30} />
            )}
          </span>
          <p className="auth-kicker">
            {auth.scope === "admin" ? "D’FABLE WORKSPACE" : "AKUN D’FABLE"}
          </p>
          <h2>
            {state === "loading"
              ? "Memeriksa tautan…"
              : success
                ? reset
                  ? "Password diperbarui."
                  : "Email terverifikasi."
                : invalid
                  ? "Tautan tidak tersedia."
                  : state === "return"
                    ? "Lanjutkan ke akunmu."
                    : reset
                      ? "Buat password baru."
                      : "Selamat datang di D’Fable."}
          </h2>
          <p className="email-description">
            {success
              ? reset
                ? "Gunakan password baru untuk masuk kembali. Sesi customer dan workspace tetap terpisah."
                : "Akunmu siap digunakan. Terima kasih sudah memastikan email ini milikmu."
              : invalid
                ? "Tautan ini tidak valid, sudah digunakan, atau kedaluwarsa. Kembali ke akun untuk meminta tautan baru."
                : state === "return"
                  ? "Masuk untuk melihat status verifikasi akun. Jika kamu membuka email di perangkat lain, lanjutkan dengan email yang sama."
                  : reset
                    ? "Pilih password yang hanya kamu tahu."
                    : "Konfirmasikan alamat email agar kamu bisa mulai memesan dan mengikuti perjalanan laundry."}
          </p>
          {email && state === "ready" && (
            <div className="email-address">
              <Mail size={17} />
              {email}
            </div>
          )}
          {state === "ready" && (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {reset && (
                <>
                  <label>
                    Password baru
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                    />
                  </label>
                  <label>
                    Ulangi password
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? "Memproses…"
                  : reset
                    ? "Simpan password"
                    : "Verifikasi email saya"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {state !== "ready" && state !== "loading" && (
            <a className="primary full" href={target}>
              {auth.scope === "admin" ? "Ke workspace" : "Ke akun saya"}
              <ArrowRight size={17} />
            </a>
          )}
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          <div className="email-security">
            <ShieldCheck size={15} />
            <span>
              {reset
                ? "Jangan bagikan password atau tautan ini."
                : "Tautan verifikasi tidak meminta password kamu."}
            </span>
          </div>
        </section>
      </div>
      <footer className="email-footer">D’Fable Laundry Studio · Cinere</footer>
    </main>
  );
}
