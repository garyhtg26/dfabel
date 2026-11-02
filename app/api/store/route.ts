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
import { calculateOrderPrice } from "@/lib/pricing";
import { normalizeServices, serviceUnitRate } from "@/lib/catalog";
import {
  orderSchema,
  updateSchema,
  pricesSchema,
  promoSchema,
} from "@/lib/order-validation";
import type { Order } from "@/lib/types";
import { serverFailure } from "@/lib/server-diagnostics";
import { paymentLocked } from "@/lib/payments/policy";
import { manualLocked } from "@/lib/payments/manual-policy";
import { signalPaymentChange } from "@/lib/payments/service";
import {
  memberCodeHash,
  validMemberCode,
  validMemberWallet,
} from "@/lib/membership-code";
import { prepareEarn, commitEarn } from "@/lib/loyalty";
import { eligibleMemberDiscount } from "@/lib/membership-eligibility";
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
      if (
        input.source !== "pos" &&
        (input.posPayment ||
          input.expectedTotal !== undefined ||
          input.membershipCode)
      )
        throw new ApiError(400, "Pilihan pembayaran kasir tidak tersedia.");
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
      if (input.membershipCode) {
        await database.runTransaction(async (tx) => {
          const attemptRef = database.doc(`membershipCodeAttempts/${user.uid}`);
          const attemptSnap = await tx.get(attemptRef);
          const now = Date.now();
          const attempts = (attemptSnap.get("attempts") || []).filter(
            (value: number) => Number.isFinite(value) && value > now - 3600000,
          );
          if (attempts.length >= 30)
            throw new ApiError(
              429,
              "Terlalu banyak percobaan kode member. Coba lagi nanti.",
            );
          tx.set(attemptRef, { attempts: [...attempts, now] });
        });
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
        const codeHash = input.membershipCode
          ? memberCodeHash(input.membershipCode)
          : null;
        const codeRef = codeHash
          ? database.doc(`membershipCodes/${codeHash}`)
          : null;
        const [settings, prior, rate, codeSnap] = await Promise.all([
          tx.get(database.doc(`settings/${branch}`)),
          tx.get(ref),
          tx.get(database.doc(`rateLimits/${user.uid}`)),
          codeRef ? tx.get(codeRef) : Promise.resolve(null),
        ]);
        if (prior.exists) return;
        let customerUid: string | null =
          input.source === "web" ? user.uid : null;
        if (codeRef) {
          const codeData = codeSnap?.data();
          if (!validMemberCode(codeData, branch, Date.now()))
            throw new ApiError(
              409,
              "Kode member tidak berlaku, kedaluwarsa, atau sudah digunakan. Minta kode baru untuk cabang ini.",
            );
          customerUid = codeData!.uid as string;
        }
        const membership = customerUid
          ? await tx.get(database.doc(`memberships/${customerUid}`))
          : null;
        if (codeRef && !validMemberWallet(membership?.data(), codeHash!))
          throw new ApiError(
            409,
            "Kode member tidak berlaku atau saldo sudah habis. Minta pelanggan memeriksa saldo dan membuat kode baru.",
          );
        const cutoff = Date.now() - 3600000;
        const attempts = (rate.get("orders") || []).filter(
          (t: number) => t > cutoff,
        );
        if (attempts.length >= (user.admin ? 120 : 10))
          throw new ApiError(429, "Terlalu banyak pesanan. Coba lagi nanti.");
        const services = normalizeServices(settings.get("services"));
        const service = services.find((item) => item.id === input.service);
        if (!service)
          throw new ApiError(400, "Layanan yang dipilih tidak tersedia.");
        const speed = input.speed || "regular";
        if (!service.rates && speed !== "regular")
          throw new ApiError(
            400,
            "Kecepatan ini tidak tersedia untuk layanan.",
          );
        if (input.kg < (service.minimumQuantity || 1))
          throw new ApiError(
            400,
            `Jumlah minimum layanan ini ${service.minimumQuantity || 1} ${service.unit}.`,
          );
        if (service.unit !== "kg" && !Number.isInteger(input.kg))
          throw new ApiError(400, "Jumlah item harus berupa bilangan bulat.");
        const unitPrice = serviceUnitRate(service, speed);
        const washService = services.find((item) => item.id === "wash")!;
        const washPrice = serviceUnitRate(washService);
        const now = new Date().toISOString();
        const {
          requestId,
          photo,
          expectedTotal,
          membershipCode,
          ...cleanInput
        } = input;
        void requestId;
        void photo;
        void membershipCode;
        const clean = {
          ...cleanInput,
          membershipDiscount: eligibleMemberDiscount(membership?.data()),
          express: speed !== "regular",
          unit: service.unit,
          speed,
          pricingVersion: 2 as const,
          minimumQuantity: service.minimumQuantity || 1,
        };
        const calculatedTotal =
          calculateOrderPrice({ ...clean, unitPrice, washPrice }, input.kg) +
          (input.insurance ? 1000 : 0);
        if (
          input.source === "pos" &&
          input.posPayment === "cash" &&
          expectedTotal !== calculatedTotal
        )
          throw new ApiError(
            409,
            "Harga layanan berubah. Periksa ulang tagihan sebelum menerima tunai.",
          );
        const status = input.source === "pos" ? 3 : 0;
        const token = randomUUID();
        const order: Order = {
          ...clean,
          id,
          token,
          uid: customerUid,
          branchId: branch,
          actualKg: input.source === "pos" ? input.kg : null,
          status,
          paid: input.source === "pos" && input.posPayment === "cash",
          ...(input.source === "pos" && input.posPayment === "cash"
            ? { paymentMethod: "cash" as const, paidAt: now }
            : {}),
          shippingFee: input.source === "pos" ? 0 : null,
          total: calculatedTotal,
          unitPrice,
          washPrice,
          photo: "",
          photoPath,
          createdAt: now,
          history: [{ status, at: now }],
        };
        const earn = order.paid ? await prepareEarn(tx, database, order) : null;
        const earnedFields = commitEarn(tx, database, order, earn, now);
        tx.create(ref, { ...order, ...earnedFields, createdBy: user.uid });
        if (codeRef) tx.delete(codeRef);
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
        if (o.unit && o.unit !== "kg" && !Number.isInteger(v.actualKg))
          throw new ApiError(400, "Jumlah aktual item harus bilangan bulat.");
        if ((o.membershipUsed || 0) > 0 && v.actualKg !== o.actualKg)
          throw new ApiError(
            409,
            "Jumlah tidak dapat diubah setelah saldo membership digunakan.",
          );
        const serviceTotal = calculateOrderPrice(o, v.actualKg);
        if ((o.pointsUsed || 0) + (o.membershipUsed || 0) > serviceTotal)
          throw new ApiError(
            409,
            "Poin dan saldo membership yang digunakan melebihi harga layanan. Minta pelanggan mengurangi penggunaannya terlebih dahulu.",
          );
        const total =
          serviceTotal -
          (o.pointsUsed || 0) -
          (o.membershipUsed || 0) +
          (o.insurance ? 1000 : 0) +
          (v.shippingFee ?? 0);
        if (total === 0 && !o.paid)
          throw new ApiError(
            409,
            "Minta pelanggan mengurangi poin sebelum mengubah jumlah atau ongkir ini.",
          );
        if (v.paid !== o.paid)
          throw new ApiError(
            409,
            "Periksa bukti transfer melalui menu pembayaran untuk mengonfirmasi tagihan. Status lunas tidak dapat diubah dari form pesanan.",
          );
        if (
          (paymentLocked(o.payment) ||
            manualLocked(o.manualPayment) ||
            o.paid ||
            o.paymentReconciliationRequired) &&
          (total !== o.total ||
            v.actualKg !== o.actualKg ||
            v.shippingFee !== o.shippingFee)
        )
          throw new ApiError(
            409,
            "Tagihan terkunci selama pembayaran sedang diperiksa atau sudah lunas. Periksa pembayaran terlebih dahulu.",
          );
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
          paymentRevision: (o.paymentRevision || 0) + 1,
          updatedBy: user.uid,
          updatedAt: new Date().toISOString(),
        });
        if (
          total !== o.total ||
          v.actualKg !== o.actualKg ||
          v.shippingFee !== o.shippingFee ||
          v.paid !== o.paid
        )
          signalPaymentChange(tx, database, o.branchId);
      });
    } else if (body.action === "prices") {
      requireManager(user);
      const prices = pricesSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branch}`);
        const snap = await tx.get(ref);
        const settings = { ...defaultStore, ...snap.data() };
        const currentServices = normalizeServices(settings.services);
        if (
          prices.length !== currentServices.length ||
          currentServices.some(
            (service) =>
              prices.some((price) => price.id === service.id) === false,
          )
        )
          throw new ApiError(400, "Daftar layanan harus lengkap.");
        const services = currentServices.map((service) => {
          const update = prices.find((price) => price.id === service.id)!;
          if (service.rates && !update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} belum lengkap.`,
            );
          if (!service.rates && update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} tidak digunakan.`,
            );
          const rates = service.rates ? update.rates! : undefined;
          return {
            ...service,
            price: rates?.regular ?? update.price,
            ...(rates ? { rates } : {}),
          };
        });
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
            services: normalizeServices(snap.get("services")),
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
