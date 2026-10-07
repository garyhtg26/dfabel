import { requestBranch } from "@/lib/branches";
import { photoStorageReady, uploadPhoto } from "@/lib/storage/photos";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { readStore } from "@/lib/store";
import { db, firebaseReady } from "@/lib/firebase/admin";
import {
  ApiError,
  identity,
  requireAdmin,
  requireManager,
  sameOrigin,
} from "@/lib/firebase/access";
import { defaultStore } from "@/lib/defaults";
import { calculatePrice } from "@/lib/pricing";
import {
  orderSchema,
  updateSchema,
  pricesSchema,
  promoSchema,
} from "@/lib/order-validation";
import type { Order, Service } from "@/lib/types";
import { serverFailure } from "@/lib/server-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
function fail(e: unknown) {
  if (e instanceof ApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
  console.error("D’Fable API failure", serverFailure(e));
  return NextResponse.json(
    { error: "Layanan sedang tidak tersedia. Coba lagi beberapa saat." },
    { status: 500 },
  );
}
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      await readStore(await identity(req), requestBranch(req.url)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const branch = requestBranch(req.url);
    if (!firebaseReady())
      throw new ApiError(
        503,
        "Firebase belum dikonfigurasi. Pesanan belum bisa diterima.",
      );
    const user = (await identity(req, true))!;
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 1700000)
      throw new ApiError(413, "Foto terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data tidak valid.");
    }
    const database = db();
    let id = "";
    if (body.action === "order") {
      const input = orderSchema.parse(body.data);
      if (input.source === "pos") requireAdmin(user);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());
      if (input.date < today)
        throw new ApiError(400, "Jadwal tidak boleh di masa lalu.");
      const key = createHash("sha256")
        .update(`${branch}:${user.uid}:${input.requestId}`)
        .digest("hex");
      id = "DF-" + key.slice(0, 12).toUpperCase();
      const ref = database.doc(`orders/${id}`);
      const existing = await ref.get();
      if (existing.exists) {
        if (existing.get("createdBy") !== user.uid)
          throw new ApiError(409, "Konflik nomor pesanan.");
        return NextResponse.json({ store: await readStore(user, branch), id });
      }
      let photoPath = "";
      if (input.photo) {
        if (!photoStorageReady())
          throw new ApiError(
            503,
            "Penyimpanan foto belum diaktifkan. Hapus foto atau hubungi toko.",
          );
        const bytes = Buffer.from(input.photo.split(",")[1], "base64");
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length > 1100000)
          throw new ApiError(400, "Foto JPEG tidak valid.");
        photoPath = `orders/${user.uid}/${id}.jpg`;
        await uploadPhoto(photoPath, bytes);
      }
      await database.runTransaction(async (tx) => {
        const [settings, prior, rate] = await Promise.all([
          tx.get(database.doc(`settings/${branch}`)),
          tx.get(ref),
          tx.get(database.doc(`rateLimits/${user.uid}`)),
        ]);
        if (prior.exists) return;
        const cutoff = Date.now() - 3600000;
        const attempts = (rate.get("orders") || []).filter(
          (t: number) => t > cutoff,
        );
        if (attempts.length >= (user.admin ? 120 : 10))
          throw new ApiError(429, "Terlalu banyak pesanan. Coba lagi nanti.");
        const services = (settings.get("services") ||
          defaultStore.services) as Service[];
        const price = services.find((s) => s.id === input.service)!.price;
        const washPrice = services.find((s) => s.id === "wash")!.price;
        const now = new Date().toISOString();
        const { requestId, photo, ...clean } = input;
        void requestId;
        void photo;
        const status = input.source === "pos" ? 3 : 0;
        const token = randomUUID();
        const order: Order = {
          ...clean,
          id,
          token,
          uid: input.source === "pos" ? null : user.uid,
          branchId: branch,
          actualKg: input.source === "pos" ? input.kg : null,
          status,
          paid: false,
          shippingFee: input.source === "pos" ? 0 : null,
          total: calculatePrice(
            input.service,
            input.kg,
            price,
            washPrice,
            input.express,
          ),
          unitPrice: price,
          washPrice,
          photo: "",
          photoPath,
          createdAt: now,
          history: [{ status, at: now }],
        };
        tx.create(ref, { ...order, createdBy: user.uid });
        tx.create(database.doc(`tracking/${token}`), { orderId: id });
        tx.set(database.doc(`rateLimits/${user.uid}`), {
          orders: [...attempts, Date.now()],
          updatedAt: now,
        });
        if (input.source === "web")
          tx.set(
            database.doc(`users/${user.uid}`),
            {
              name: input.name,
              phone: input.phone,
              email: user.email,
              updatedAt: now,
            },
            { merge: true },
          );
        else
          tx.set(
            database.doc(
              `walkInCustomers/${createHash("sha256").update(input.phone).digest("hex")}`,
            ),
            { name: input.name, phone: input.phone, updatedAt: now },
            { merge: true },
          );
      });
    } else if (body.action === "update") {
      requireAdmin(user);
      const v = updateSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`orders/${v.id}`);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
        const o = snap.data() as Order;
        if (o.branchId !== branch)
          throw new ApiError(
            409,
            "Pesanan berada di cabang lain. Buka workspace yang sesuai.",
          );
        if (v.status < o.status)
          throw new ApiError(400, "Status tidak boleh mundur.");
        if (v.paid && v.shippingFee === null)
          throw new ApiError(400, "Konfirmasi ongkir sebelum menandai lunas.");
        const total =
          calculatePrice(
            o.service,
            v.actualKg,
            o.unitPrice,
            o.washPrice,
            o.express,
          ) + (v.shippingFee ?? 0);
        if (o.paid && v.paid && total !== o.total)
          throw new ApiError(
            400,
            "Batalkan tanda lunas sebelum mengubah tagihan.",
          );
        const history = [...o.history];
        if (v.status !== o.status)
          history.push({ status: v.status, at: new Date().toISOString() });
        tx.update(ref, {
          status: v.status,
          actualKg: v.actualKg,
          shippingFee: v.shippingFee,
          paid: v.paid,
          total,
          history,
          updatedBy: user.uid,
          updatedAt: new Date().toISOString(),
        });
      });
    } else if (body.action === "prices") {
      requireManager(user);
      const prices = pricesSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branch}`);
        const snap = await tx.get(ref);
        const settings = { ...defaultStore, ...snap.data() };
        const services = (settings.services as Service[]).map((s) => ({
          ...s,
          price: prices.find((v) => v.id === s.id)!.price,
        }));
        tx.set(
          ref,
          { services, promo: settings.promo, updatedBy: user.uid },
          { merge: true },
        );
      });
    } else if (body.action === "promo") {
      requireManager(user);
      const promo = promoSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branch}`);
        const snap = await tx.get(ref);
        tx.set(
          ref,
          {
            services: snap.get("services") || defaultStore.services,
            promo,
            updatedBy: user.uid,
          },
          { merge: true },
        );
      });
    } else throw new ApiError(400, "Aksi tidak dikenal.");
    return NextResponse.json({ store: await readStore(user, branch), id });
  } catch (e) {
    return fail(e);
  }
}
