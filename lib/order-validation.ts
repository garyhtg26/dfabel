import { z } from "zod";
import { normalizePhone } from "./pricing";
export const orderSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+628\d{7,12}$/, "Nomor WhatsApp tidak valid")),
  service: z.enum(["complete", "wash", "iron"]),
  kg: z.number().min(1).max(100),
  express: z.boolean(),
  address: z.string().trim().min(8).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  date: z.iso.date(),
  slot: z.enum(["09.00–12.00", "12.00–15.00", "15.00–18.00"]),
  notes: z.string().max(1000),
  photo: z
    .string()
    .max(1500000)
    .refine(
      (v) => !v || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v),
      "Foto harus berupa JPEG",
    ),
  source: z.enum(["web", "pos"]),
});
export const updateSchema = z.object({
  id: z.string().regex(/^DF-[A-F0-9]{12}$/),
  status: z.number().int().min(0).max(7),
  actualKg: z.number().min(0.1).max(100),
  paid: z.boolean(),
  shippingFee: z.number().int().min(0).max(10000000).nullable(),
});
export const pricesSchema = z
  .array(
    z.object({
      id: z.enum(["complete", "wash", "iron", "member"]),
      price: z.number().int().min(1000).max(10000000),
    }),
  )
  .length(4)
  .refine(
    (p) => new Set(p.map((v) => v.id)).size === 4,
    "Layanan harus lengkap dan unik",
  )
  .refine(
    (p) =>
      p.find((v) => v.id === "complete")!.price >=
      p.find((v) => v.id === "wash")!.price,
    "Harga lengkap minimal sama dengan cuci-kering",
  );
export const promoSchema = z.object({
  title: z.string().trim().min(3).max(90),
  description: z.string().max(220),
  code: z.string().max(24),
  button: z.string().trim().min(1).max(35).default("Jemput sekarang"),
  active: z.boolean(),
});
