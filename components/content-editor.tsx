"use client";
import { useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { useAuth } from "./auth-provider";
import { prepareImage } from "@/lib/image-upload";
import {
  siteContent,
  siteImage,
  mediaSlots,
  type MediaSlot,
} from "@/lib/site-content";
import type { Store } from "@/lib/types";
const labels: Record<MediaSlot, string> = {
  promo: "Promo utama",
  people: "Jemput & antar",
  member: "Paket bulanan",
  wash: "Cuci & kering",
  complete: "Cuci, kering & setrika",
  iron: "Setrika saja",
};
export default function ContentEditor({
  store,
  onSaved,
}: {
  store: Store;
  onSaved: () => Promise<void>;
}) {
  const auth = useAuth();
  const [content, setContent] = useState(() => siteContent(store.content));
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function upload(slot: MediaSlot, file: File) {
    setBusy(slot);
    setError("");
    setNotice("");
    try {
      const image = await prepareImage(file);
      const r = await auth.request(
        `/api/media/banners/${slot}?branch=${store.branchId || "cinere"}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: image,
        },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setContent((c) => ({ ...c, images: { ...c.images, [slot]: data.url } }));
      await onSaved();
      setNotice(`Gambar ${labels[slot]} sudah diperbarui di web pelanggan.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="content-editor">
      <div className="content-editor-heading">
        <h2>Gambar website</h2>
        <p>Gambar yang diunggah langsung tampil di web pelanggan.</p>
      </div>
      <div className="media-editor-grid">
        {mediaSlots.map((slot) => (
          <article className="media-editor-card" key={slot}>
            <img src={siteImage(content, slot)} alt={labels[slot]} />
            <div>
              <h3>{labels[slot]}</h3>
              <label className="secondary photo-upload-label">
                <ImagePlus size={16} />{" "}
                {busy === slot ? "Mengunggah…" : "Ganti gambar"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!!busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void upload(slot, file);
                  }}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <form
        className="panel auth-form content-copy-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy("content");
          setError("");
          setNotice("");
          try {
            const { images, ...settings } = content;
            const r = await auth.request(
              `/api/admin/content?branch=${store.branchId || "cinere"}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
              },
            );
            const data = await r.json();
            if (!r.ok) throw Error(data.error);
            await onSaved();
            setNotice("Pengaturan banner tersimpan.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy("");
          }
        }}
      >
        <h2>Banner lainnya</h2>
        {(["people", "member", "tracking"] as const).map((key) => (
          <fieldset key={key} className="content-fields">
            <legend>
              {key === "people"
                ? "Jemput & antar"
                : key === "member"
                  ? "Paket bulanan"
                  : "Tracking"}
            </legend>
            <label>
              Judul
              <input
                required
                maxLength={80}
                value={content[key].title}
                onChange={(e) =>
                  setContent((c) => ({
                    ...c,
                    [key]: { ...c[key], title: e.target.value },
                  }))
                }
              />
            </label>
            {key !== "tracking" && (
              <label>
                Teks tombol
                <input
                  required
                  maxLength={35}
                  value={content[key].button}
                  onChange={(e) =>
                    setContent((c) => ({
                      ...c,
                      [key]: { ...c[key], button: e.target.value },
                    }))
                  }
                />
              </label>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={content[key].active}
                onChange={(e) =>
                  setContent((c) => ({
                    ...c,
                    [key]: { ...c[key], active: e.target.checked },
                  }))
                }
              />
              Tampilkan di web pelanggan
            </label>
          </fieldset>
        ))}
        <button className="primary" disabled={!!busy}>
          <Save size={17} />{" "}
          {busy === "content" ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </form>
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
    </section>
  );
}
