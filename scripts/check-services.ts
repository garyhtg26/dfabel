import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { db } from "../lib/firebase/admin";
import { uploadPhoto, downloadPhoto } from "../lib/storage/photos";
loadEnvConfig(process.cwd());

async function main() {
  try {
    await db().doc("settings/cinere").get();
    console.log("Firestore: connected.");
  } catch (e) {
    console.error(
      "Firestore: failed; code=" +
        String((e as { code?: unknown }).code ?? "unknown"),
    );
    process.exitCode = 1;
  } finally {
    await db().terminate();
  }

  const bucket = encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!);
  const headers = { apikey: process.env.SUPABASE_SECRET_KEY! };
  const base = process.env.SUPABASE_URL + "/storage/v1/";
  const response = await fetch(base + "bucket/" + bucket, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Bucket check HTTP " + response.status);
  const info = await response.json();
  if (info.public !== false) throw new Error("Bucket must be private");
  console.log("Supabase: private bucket confirmed.");
  if (!process.argv.includes("--upload")) return;

  // A disposable storage probe, never an order or customer photo.
  const path = `orders/storage-check/DF-${randomBytes(6).toString("hex").toUpperCase()}.jpg`;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  try {
    await uploadPhoto(path, bytes);
    const downloaded = await downloadPhoto(path);
    if (!Buffer.from(downloaded).equals(Buffer.from(bytes)))
      throw new Error("Download mismatch");
    const publicResponse = await fetch(
      base + `object/public/${bucket}/${path}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (publicResponse.ok) throw new Error("Public access must be denied");
    console.log(
      "Supabase: upload/download matched; unauthenticated public access denied.",
    );
  } finally {
    const removed = await fetch(base + "object/" + bucket, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!removed.ok)
      throw new Error("Probe cleanup failed HTTP " + removed.status);
    console.log("Supabase: disposable probe removed.");
  }
}
main().catch((e) => {
  // Never log upstream response bodies, request headers or credential values.
  console.error(
    "Service check failed: " + (e instanceof Error ? e.message : "unknown"),
  );
  process.exitCode = 1;
});
