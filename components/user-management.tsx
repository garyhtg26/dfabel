"use client";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck, User, Trash2, Save } from "lucide-react";
import { useAuth } from "./auth-provider";
type Row = {
  uid: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  verified: boolean;
  self: boolean;
  providers: string[];
};
export default function UserManagement() {
  const auth = useAuth();
  const [users, setUsers] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Row | null>(null);
  async function load(next?: string) {
    setError("");
    try {
      const r = await auth.request(
        "/api/admin/users" +
          (next ? "?cursor=" + encodeURIComponent(next) : ""),
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setUsers((prev) => (next ? [...prev, ...d.users] : d.users));
      setCursor(d.cursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function mutate(data: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await auth.request("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNotice("Perubahan tersimpan.");
      setAdding(false);
      setPending(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="user-management">
      <div className="users-toolbar">
        <div>
          <h2>Tim & pelanggan</h2>
          <p>Atur siapa yang dapat mengakses workspace.</p>
        </div>
        <button className="primary" onClick={() => setAdding(!adding)}>
          <Plus size={17} /> Tambah pengguna
        </button>
      </div>
      <div className="role-guide">
        <span>
          <b>Pemilik / Admin</b> Pengguna, harga, promosi, dan operasional
        </span>
        <span>
          <b>Staf</b> Pesanan dan POS
        </span>
        <span>
          <b>Customer</b> Pesanan pribadi
        </span>
      </div>
      {adding && (
        <form
          className="panel auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutate({
              action: "create",
              name: f.get("name"),
              email: f.get("email"),
              password: f.get("password"),
              role: f.get("role"),
            });
          }}
        >
          <h3>Akun baru</h3>
          <div className="form-two">
            <label>
              Nama
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          </div>
          <div className="form-two">
            <label>
              Password awal
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
              />
            </label>
            <label>
              Akses
              <select name="role" defaultValue="staff">
                <option value="customer">Customer</option>
                <option value="staff">Staf</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Pengguna perlu memverifikasi email saat login pertama. Password
            tidak ditampilkan lagi setelah disimpan.
          </p>
          <button disabled={busy} className="primary">
            Buat pengguna
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="auth-notice">
          {notice}
        </p>
      )}
      {pending && (
        <div className="delete-confirm" role="alert">
          <div>
            <b>Hapus akun {pending.email}?</b>
            <p>
              Login akun dihapus permanen. Riwayat transaksi toko tetap
              tersimpan.
            </p>
          </div>
          <button disabled={busy} onClick={() => setPending(null)}>
            Batal
          </button>
          <button
            className="danger-action"
            disabled={busy}
            onClick={() => mutate({ action: "delete", uid: pending.uid })}
          >
            Ya, hapus akun
          </button>
        </div>
      )}
      <div className="users-list">
        {users.map((u) => (
          <UserRow
            key={u.uid}
            row={u}
            busy={busy}
            onSave={(role, disabled) =>
              mutate({ action: "access", uid: u.uid, role, disabled })
            }
            onDelete={() => setPending(u)}
          />
        ))}
      </div>
      {!users.length && !error && <p className="muted">Memuat pengguna…</p>}
      {cursor && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => load(cursor)}
        >
          Muat pengguna berikutnya
        </button>
      )}
    </section>
  );
}
function UserRow({
  row,
  busy,
  onSave,
  onDelete,
}: {
  row: Row;
  busy: boolean;
  onSave: (role: string, disabled: boolean) => void;
  onDelete: () => void;
}) {
  const [role, setRole] = useState(row.role);
  const [disabled, setDisabled] = useState(row.disabled);
  const protectedUser = row.self || row.role === "owner";
  useEffect(() => {
    setRole(row.role);
    setDisabled(row.disabled);
  }, [row]);
  return (
    <article className="user-row">
      <span className="user-row-icon">
        {row.role === "customer" ? (
          <User size={21} />
        ) : (
          <ShieldCheck size={21} />
        )}
      </span>
      <div className="user-row-info">
        <b>
          {row.name || "Tanpa nama"}
          {row.self ? " · kamu" : ""}
        </b>
        <span>{row.email}</span>
        <small>
          {row.verified ? "Email terverifikasi" : "Belum verifikasi"} ·{" "}
          {row.disabled ? "Nonaktif" : "Aktif"}
        </small>
      </div>
      <div className="user-row-controls">
        <label>
          <span className="sr-only">Akses {row.email}</span>
          <select
            value={role}
            disabled={protectedUser || busy}
            onChange={(e) => setRole(e.target.value)}
          >
            {row.role === "owner" && <option value="owner">Pemilik</option>}
            <option value="customer">Customer</option>
            <option value="staff">Staf</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="user-disabled">
          <input
            type="checkbox"
            checked={disabled}
            disabled={protectedUser || busy}
            onChange={(e) => setDisabled(e.target.checked)}
          />{" "}
          Nonaktif
        </label>
        <button
          title="Simpan akses"
          aria-label={`Simpan akses ${row.email}`}
          disabled={
            protectedUser ||
            busy ||
            (role === row.role && disabled === row.disabled)
          }
          onClick={() => onSave(role, disabled)}
        >
          <Save size={17} />
        </button>
        <button
          className="danger-action"
          title="Hapus pengguna"
          aria-label={`Hapus ${row.email}`}
          disabled={protectedUser || busy}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}
