"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  UserRound,
  LogOut,
  X,
  Camera,
  LockKeyhole,
  Loader2,
} from "lucide-react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "./auth-provider";
import { prepareImage } from "@/lib/image-upload";
export default function DashboardAccount({
  branchName = "Cinere",
}: {
  branchName?: string;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(auth.name);
  const [photoVersion, setPhotoVersion] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let alive = true;
    auth
      .request("/api/profile")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (alive) {
          setName(data.name || auth.name);
          setPhotoVersion(data.photoVersion);
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "Profil belum dapat dimuat. Tutup dan buka halaman untuk mencoba lagi.",
          );
      });
    return () => {
      alive = false;
    };
  }, [auth.user?.uid]);
  useEffect(() => {
    if (!photoVersion) return;
    let url = "";
    let alive = true;
    auth
      .request(`/api/profile/photo?v=${photoVersion}`)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const blob = await r.blob();
        if (alive) {
          url = URL.createObjectURL(blob);
          setPhoto(url);
        }
      })
      .catch(() => {
        if (alive) setPhoto("");
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoVersion]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  useEffect(() => {
    if (!editing) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [editing]);
  async function run(
    key: string,
    action: () => Promise<void>,
    message: string,
  ) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code?.startsWith("auth/")
          ? "Password belum berhasil diubah. Periksa password saat ini; jika sesi habis, masuk kembali."
          : e instanceof Error
            ? e.message
            : "Perubahan belum tersimpan.",
      );
    } finally {
      setBusy("");
    }
  }
  const avatar = photo ? (
    <img src={photo} alt="Foto profil" />
  ) : (
    <UserRound size={19} />
  );
  return (
    <>
      <div className="account-menu-wrap" ref={wrapper}>
        <button
          ref={trigger}
          className={`account-trigger ${open ? "is-open" : ""}`}
          aria-expanded={open}
          aria-controls="account-dropdown"
          onClick={() => setOpen(!open)}
        >
          <span className="account-avatar">{avatar}</span>
          <span className="admin-account-info">
            <b>{auth.name || name || "Admin"}</b>
            <small>Cabang {branchName}</small>
          </span>
          <ChevronDown size={16} className="account-chevron" />
        </button>
        {open && (
          <div className="account-dropdown" id="account-dropdown">
            <div className="account-dropdown-heading">
              <b>Akun saya</b>
              <span>{auth.user?.email}</span>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setNotice("");
                setEditing(true);
              }}
            >
              <UserRound size={18} /> Profil
            </button>
            <button
              className="account-signout"
              onClick={() =>
                run(
                  "logout",
                  async () => {
                    await auth.logout();
                    setOpen(false);
                  },
                  "",
                )
              }
              disabled={!!busy}
            >
              <LogOut size={18} /> Keluar akun
            </button>
            {busy === "logout" && <span role="status">Keluar…</span>}
            {error && !editing && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      {editing && (
        <dialog
          ref={dialog}
          className="profile-dialog"
          aria-labelledby="profile-dialog-title"
          onCancel={() => setEditing(false)}
          onClose={() => {
            setEditing(false);
            trigger.current?.focus();
          }}
        >
          <div className="profile-dialog-heading">
            <div>
              <span className="eyebrow">AKUN SAYA</span>
              <h2 id="profile-dialog-title">Profil</h2>
            </div>
            <button
              aria-label="Tutup profil"
              onClick={() => dialog.current?.close()}
            >
              <X size={21} />
            </button>
          </div>
          <div className="profile-dialog-body">
            <div className="profile-photo-row">
              <span className="profile-avatar">{avatar}</span>
              <div>
                <label
                  className={`secondary photo-upload-label ${busy ? "is-disabled" : ""}`}
                >
                  <Camera size={17} />{" "}
                  {busy === "photo" ? "Mengunggah…" : "Ganti foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!!busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file)
                        void run(
                          "photo",
                          async () => {
                            const image = await prepareImage(file, 512);
                            const r = await auth.request("/api/profile/photo", {
                              method: "POST",
                              headers: { "Content-Type": "image/jpeg" },
                              body: image,
                            });
                            const data = await r.json();
                            if (!r.ok) throw Error(data.error);
                            setPhotoVersion(data.photoVersion);
                          },
                          "Foto profil diperbarui.",
                        );
                    }}
                  />
                </label>
                <small>JPG, PNG, WebP · maks. 8 MB</small>
              </div>
            </div>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "profile",
                  async () => {
                    const r = await auth.request("/api/profile", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name }),
                    });
                    const data = await r.json();
                    if (!r.ok) throw Error(data.error);
                    await auth.refresh();
                  },
                  "Nama diperbarui.",
                );
              }}
            >
              <label>
                Nama
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label>
                <span className="locked-label">
                  Email <LockKeyhole size={13} />
                </span>
                <input
                  value={auth.user?.email || ""}
                  readOnly
                  aria-readonly="true"
                  className="locked-input"
                />
              </label>
              <button className="primary" disabled={!!busy}>
                {busy === "profile" ? "Menyimpan…" : "Simpan profil"}
              </button>
            </form>
            <form
              className="auth-form password-section"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                void run(
                  "password",
                  async () => {
                    const password = String(data.get("password"));
                    if (
                      password.length < 8 ||
                      password !== data.get("confirmation")
                    )
                      throw Error(
                        "Password minimal 8 karakter dan konfirmasi harus sama.",
                      );
                    if (!auth.user?.email)
                      throw Error("Masuk kembali untuk mengubah password.");
                    await reauthenticateWithCredential(
                      auth.user,
                      EmailAuthProvider.credential(
                        auth.user.email,
                        String(data.get("current")),
                      ),
                    );
                    await updatePassword(auth.user, password);
                    await auth.refresh();
                    form.reset();
                  },
                  "Password berhasil diperbarui.",
                );
              }}
            >
              <h3>Ganti password</h3>
              <label>
                Password saat ini
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <div className="form-two">
                <label>
                  Password baru
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Ulangi password baru
                  <input
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
              </div>
              <button className="secondary" disabled={!!busy}>
                {busy === "password" ? "Memperbarui…" : "Ubah password"}
              </button>
            </form>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
