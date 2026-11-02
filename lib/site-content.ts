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
  promo: "/promo-washer-optimized.webp",
  people: "/unsplash/laundry-people-web.webp",
  member: "/unsplash/folding-web.webp",
  wash: "/shirt-optimized.webp",
  complete: "/unsplash/clean-web.webp",
  iron: "/unsplash/ironing-web.webp",
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
  member: {
    title: "Membership D’Fable",
    button: "Lihat membership",
    active: true,
  },
  tracking: { title: "Lacak pesanan", active: true },
};
export function siteContent(value?: Partial<SiteContent>): SiteContent {
  const member = { ...defaultContent.member, ...value?.member };
  if (member.title === "Paket bulanan") member.title = "Membership D’Fable";
  if (member.button === "Lihat paket") member.button = "Lihat membership";
  return {
    people: { ...defaultContent.people, ...value?.people },
    member,
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
