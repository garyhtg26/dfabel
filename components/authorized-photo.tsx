"use client";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
export default function AuthorizedPhoto({ src }: { src: string }) {
  const auth = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    auth
      .request(src)
      .then(async (r) => {
        if (!r.ok) throw Error();
        const blob = await r.blob();
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return error ? (
    <p className="text-sm text-slate-500">Foto belum dapat dimuat.</p>
  ) : url ? (
    <img className="detail-photo" src={url} alt="Foto cucian pelanggan" />
  ) : (
    <p className="text-sm text-slate-400">Memuat foto…</p>
  );
}
