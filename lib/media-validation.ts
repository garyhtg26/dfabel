import { ApiError } from "./firebase/access";
import sharp from "sharp";
export async function readJpeg(req: Request) {
  if (req.headers.get("content-type") !== "image/jpeg")
    throw new ApiError(400, "Gunakan gambar JPEG.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Gambar kosong.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new ApiError(413, "Gambar maksimal 2 MB setelah diproses.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    bytes.at(-2) !== 0xff ||
    bytes.at(-1) !== 0xd9
  )
    throw new ApiError(400, "Gambar JPEG tidak valid.");
  try {
    return await sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
    })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ApiError(400, "Gambar rusak atau resolusinya terlalu besar.");
  }
}
