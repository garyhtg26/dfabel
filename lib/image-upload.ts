export async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("Gunakan JPG, PNG, atau WebP maksimal 8 MB.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("Gambar tidak dapat diproses.")),
        "image/jpeg",
        0.82,
      ),
    );
    if (result.size > 2 * 1024 * 1024)
      throw Error("Gambar masih terlalu besar. Pilih ukuran lebih kecil.");
    return result;
  } finally {
    image.close();
  }
}
