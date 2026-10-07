import "server-only";

export const photoStorageReady = () =>
  Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET,
  );

async function storageRequest(path: string, init: RequestInit = {}) {
  if (!photoStorageReady()) throw new Error("PHOTO_STORAGE_NOT_CONFIGURED");
  const base = new URL(process.env.SUPABASE_URL!);
  if (base.protocol !== "https:") throw new Error("INVALID_STORAGE_URL");
  const response = await fetch(new URL(`/storage/v1/${path}`, base), {
    ...init,
    headers: { ...init.headers, apikey: process.env.SUPABASE_SECRET_KEY! },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`PHOTO_STORAGE_ERROR_${response.status}`);
  return response;
}

async function privateBucket() {
  const name = encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET || "");
  const response = await storageRequest(`bucket/${name}`);
  const bucket = await response.json();
  if (bucket.public !== false) throw new Error("PHOTO_BUCKET_MUST_BE_PRIVATE");
  return name;
}

function objectPath(path: string) {
  if (
    !/^(?:orders\/[^/]+\/DF-[A-F0-9]{12}|profiles\/[^/]+\/avatar|banners\/(?:bogor\/)?(?:promo|people|member|wash|complete|iron)\/image)\.jpg$/.test(
      path,
    )
  )
    throw new Error("INVALID_PHOTO_PATH");
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadPhoto(path: string, bytes: Uint8Array) {
  const bucket = await privateBucket();
  await storageRequest(`object/${bucket}/${objectPath(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
      "Cache-Control": "no-store",
    },
    body: new Uint8Array(bytes),
  });
}

export async function downloadPhoto(path: string) {
  const bucket = await privateBucket();
  const response = await storageRequest(
    `object/authenticated/${bucket}/${objectPath(path)}`,
  );
  return new Uint8Array(await response.arrayBuffer());
}
