import { z } from "zod";
export const mediaSlots = [
  "promo",
  "people",
  "member",
  "wash",
  "complete",
  "iron",
] as const;
export type MediaSlot = (typeof mediaSlots)[number];
export const mediaSlotSchema = z.enum(mediaSlots);
export const defaultImages: Record<MediaSlot, string> = {
  promo: "/promo-washer-v2.png",
  people: "/unsplash/people.jpg",
  member: "/laundry.png",
  wash: "/unsplash/shirt.jpg",
  complete: "/laundry.png",
  iron: "/laundry-ironing-v3.png",
};
const banner = z
  .object({
    title: z.string().trim().min(1).max(80),
    button: z.string().trim().min(1).max(35),
    active: z.boolean(),
  })
  .strict();
export const contentSchema = z
  .object({
    people: banner,
    member: banner,
    tracking: z
      .object({ title: z.string().trim().min(1).max(80), active: z.boolean() })
      .strict(),
  })
  .strict();
export type SiteContent = z.infer<typeof contentSchema> & {
  images?: Partial<Record<MediaSlot, string>>;
};
export const defaultContent: SiteContent = {
  people: { title: "Jemput & antar", button: "Jadwalkan jemput", active: true },
  member: { title: "Paket bulanan", button: "Lihat paket", active: true },
  tracking: { title: "Lacak pesanan", active: true },
};
export function siteContent(value?: Partial<SiteContent>): SiteContent {
  return {
    people: { ...defaultContent.people, ...value?.people },
    member: { ...defaultContent.member, ...value?.member },
    tracking: { ...defaultContent.tracking, ...value?.tracking },
    images: { ...value?.images },
  };
}
export function siteImage(content: SiteContent, slot: MediaSlot) {
  const value = content.images?.[slot];
  return value &&
    /^\/api\/media\/banners\/(promo|people|member|wash|complete|iron)\?v=[a-f0-9-]+(?:&branch=(?:cinere|bogor))?$/.test(
      value,
    )
    ? value
    : defaultImages[slot];
}
