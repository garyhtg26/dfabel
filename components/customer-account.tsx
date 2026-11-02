"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "./auth-provider";
import { phoneFromLoginEmail } from "@/lib/phone-auth";
import "./customer-account.css";

export default function CustomerAccount({ onLogin }: { onLogin: () => void }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  const signedIn = !!auth.user && auth.verified;
  return (
    <div className="customer-account" ref={container}>
      <button
        ref={trigger}
        type="button"
        className="account-button customer-account-trigger"
        aria-label={signedIn ? "Menu akun pelanggan" : "Masuk akun pelanggan"}
        aria-expanded={signedIn ? open : undefined}
        onClick={() => (signedIn ? setOpen(!open) : onLogin())}
      >
        <User size={18} />
        <span>
          {auth.loading
            ? "Memuat…"
            : signedIn
              ? auth.name || "Akun saya"
              : "Masuk"}
        </span>
        {signedIn && <ChevronDown size={15} aria-hidden="true" />}
      </button>
      {signedIn && open && (
        <div className="customer-account-menu">
          <div className="customer-account-name">
            <strong>{auth.name || "Akun saya"}</strong>
            <small>
              {phoneFromLoginEmail(auth.user?.email) || auth.user?.email}
            </small>
          </div>
          <Link href="/profil" onClick={() => setOpen(false)}>
            <User size={17} /> Profil saya
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await auth.logout();
                setOpen(false);
              } catch {
                setError("Belum bisa keluar. Coba lagi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={17} /> {busy ? "Keluar…" : "Keluar"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
