"use client";
import { useState } from "react";
import { LogIn, LogOut, ShieldCheck, User, Info } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-5 py-2">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        {admin ? <ShieldCheck size={27} /> : <User size={27} />}
      </span>
      <div>
        <p className="!mb-2 text-xs font-semibold tracking-[.14em] text-indigo-500">
          D’FABLE {admin ? "WORKSPACE" : "ACCOUNT"}
        </p>
        <h2 className="!mb-2 !text-3xl">
          {auth.user
            ? `Halo, ${auth.user.displayName?.split(" ")[0] || "teman D’Fable"}.`
            : "Masuk, tanpa ribet."}
        </h2>
        <p className="!mb-0 text-sm leading-relaxed text-slate-500">
          {auth.user
            ? auth.user.email
            : admin
              ? "Gunakan akun Google admin toko."
              : "Gunakan Google untuk pesan dan menyimpan riwayat laundry."}
        </p>
      </div>
      {auth.user ? (
        <>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            <b className="block font-medium text-slate-800">Nomor WhatsApp</b>
            <span>{phone || "Diisi saat pemesanan pertama."}</span>
          </div>
          <button className="primary full" onClick={onDone}>
            Lanjutkan
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 py-2 text-sm text-slate-500"
            onClick={async () => {
              await auth.logout();
              onDone?.();
            }}
          >
            <LogOut size={17} /> Keluar
          </button>
        </>
      ) : (
        <button
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          disabled={busy || !auth.configured}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await auth.login();
              onDone?.();
            } catch (e) {
              const code = (e as { code?: string }).code;
              setError(
                code === "auth/popup-closed-by-user"
                  ? "Login dibatalkan. Silakan coba lagi."
                  : code === "auth/unauthorized-domain"
                    ? "Domain ini belum diizinkan di Firebase Authentication."
                    : code === "auth/popup-blocked"
                      ? "Izinkan pop-up untuk masuk dengan Google."
                      : "Login belum berhasil. Periksa koneksi dan konfigurasi Firebase.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogIn size={18} />
          {busy ? "Menghubungkan…" : "Lanjutkan dengan Google"}
        </button>
      )}
      {!auth.configured && (
        <div className="flex gap-2 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
          <Info size={18} className="shrink-0" />
          <span>
            Preview desain. Login dan transaksi aktif setelah konfigurasi
            Firebase diisi.
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
