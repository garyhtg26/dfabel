import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readJpeg } from "../../lib/media-validation";
const request = (bytes: Uint8Array, type = "image/jpeg") =>
  new Request("http://localhost/api/profile/photo", {
    method: "POST",
    headers: { "Content-Type": type },
    body: new Uint8Array(bytes),
  });
test("upload decodes a real JPEG and strips metadata", async () => {
  const original = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "blue" },
  })
    .withMetadata()
    .jpeg()
    .toBuffer();
  const result = await readJpeg(request(original));
  const meta = await sharp(result).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 4);
  assert.equal(meta.exif, undefined);
});
test("upload rejects SVG, forged JPEG, and excessive payloads", async () => {
  await assert.rejects(
    readJpeg(request(new Uint8Array([1, 2, 3]), "image/svg+xml")),
    /JPEG/,
  );
  await assert.rejects(
    readJpeg(request(new Uint8Array([255, 216, 255, 0, 255, 217]))),
    /rusak/,
  );
  await assert.rejects(
    readJpeg(request(new Uint8Array(2 * 1024 * 1024 + 1))),
    /maksimal/,
  );
});
