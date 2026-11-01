import type { BranchId } from "./branches";

type Requester = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 12_000;

export async function requestBranchStore(
  request: Requester,
  branch: BranchId,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOutRequest = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(
        new Error(
          "Koneksi belum merespons. Periksa internet lalu coba lagi.",
        ),
      );
    }, timeoutMs);
  });

  try {
    const loading = async () => {
      const response = await request(`/api/store?branch=${branch}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error("Data cabang belum bisa dimuat. Coba lagi.");
      return response.json();
    };
    return await Promise.race([loading(), timedOutRequest]);
  } catch (error) {
    if (timedOut) {
      throw new Error(
        "Koneksi belum merespons. Periksa internet lalu coba lagi.",
      );
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
