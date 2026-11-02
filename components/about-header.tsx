"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import AccountPanel from "./account-panel";
import { AuthProvider } from "./auth-provider";
import CustomerAccount from "./customer-account";
import {
  isBranchId,
  resolveCustomerBranch,
  type BranchId,
} from "@/lib/branches";

export function CustomerHeader({
  active = "about",
}: {
  active?: "about" | "profile";
}) {
  const [branch, setBranch] = useState<BranchId>("cinere");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const manualSelection = useRef(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("branch");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("dfable-customer-branch");
    } catch {}
    setBranch(resolveCustomerBranch({ requested, saved }));
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!manualSelection.current)
          setBranch(
            resolveCustomerBranch({
              detected: {
                latitude: coords.latitude,
                longitude: coords.longitude,
              },
              requested,
              saved,
            }),
          );
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousOverflow = document.body.style.overflow;
    if (!element.open) element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const page = (view: string) => `/?view=${view}&branch=${branch}`;
  return (
    <>
      <header className="customer-header">
        <Link
          className="brand"
          href={page("home")}
          aria-label="D’Fable beranda"
        >
          <img src="/dfable-logo.png" alt="D’Fable Laundry Studio" />
        </Link>
        <nav>
          <Link href={page("home")}>Beranda</Link>
          <Link href={page("services")}>Layanan & harga</Link>
          <Link href={page("tracking")}>Lacak pesanan</Link>
          <Link className={active === "about" ? "active" : ""} href="/tentang">
            Tentang D’Fable
          </Link>
        </nav>
        <div className="header-right">
          <label className="customer-branch-select">
            <span className="sr-only">Cabang laundry</span>
            <select
              aria-label="Cabang laundry"
              value={branch}
              onChange={(event) => {
                const next = event.target.value;
                if (!isBranchId(next)) return;
                manualSelection.current = true;
                setBranch(next);
                try {
                  localStorage.setItem("dfable-customer-branch", next);
                } catch {}
                const url = new URL(window.location.href);
                url.searchParams.set("branch", next);
                window.history.replaceState(window.history.state, "", url);
              }}
            >
              <option value="cinere">Cinere</option>
              <option value="bogor">Cibubur</option>
            </select>
          </label>
          <CustomerAccount onLogin={() => setOpen(true)} />
        </div>
      </header>
      <dialog
        ref={dialog}
        className="auth-dialog"
        aria-label="Akun pelanggan"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
      >
        <button
          className="close-button"
          aria-label="Tutup"
          onClick={() => setOpen(false)}
        >
          <X size={21} />
        </button>
        <AccountPanel onDone={() => setOpen(false)} />
      </dialog>
    </>
  );
}

export default function AboutHeader() {
  return (
    <AuthProvider scope="customer">
      <CustomerHeader />
    </AuthProvider>
  );
}
