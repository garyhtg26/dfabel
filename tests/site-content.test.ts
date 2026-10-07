import test from "node:test";
import assert from "node:assert/strict";
import {
  contentSchema,
  defaultContent,
  siteContent,
  siteImage,
  mediaSlotSchema,
} from "../lib/site-content";
test("older settings retain all banner defaults and independent image slots", () => {
  const content = siteContent({
    images: { wash: "/api/media/banners/wash?v=1234-abcd" },
  });
  assert.equal(content.people.active, true);
  assert.equal(
    siteImage(content, "wash"),
    "/api/media/banners/wash?v=1234-abcd",
  );
  assert.equal(siteImage(content, "iron"), "/laundry-ironing-v3.png");
});
test("content writes cannot inject arbitrary photo URLs or unknown fields", () => {
  assert.equal(contentSchema.safeParse(defaultContent).success, true);
  assert.equal(
    contentSchema.safeParse({
      ...defaultContent,
      images: { promo: "https://untrusted.invalid/image" },
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...defaultContent,
      people: { ...defaultContent.people, title: "" },
    }).success,
    false,
  );
  assert.equal(
    mediaSlotSchema.safeParse("../profiles/user/avatar").success,
    false,
  );
  assert.equal(
    siteImage(
      siteContent({ images: { promo: "https://untrusted.invalid/image" } }),
      "promo",
    ),
    "/promo-washer-v2.png",
  );
});

import { requestBranch, branchMediaPath } from "../lib/branches";
test("branch requests reject unknown workspaces and keep banner storage isolated", () => {
  assert.equal(requestBranch("https://example.com/api/store"), "cinere");
  assert.equal(
    requestBranch("https://example.com/api/store?branch=bogor"),
    "bogor",
  );
  assert.throws(() =>
    requestBranch("https://example.com/api/store?branch=../users"),
  );
  assert.notEqual(
    branchMediaPath("cinere", "promo"),
    branchMediaPath("bogor", "promo"),
  );
  assert.equal(
    siteImage(
      siteContent({
        images: { promo: "/api/media/banners/promo?v=abcd&branch=bogor" },
      }),
      "promo",
    ),
    "/api/media/banners/promo?v=abcd&branch=bogor",
  );
});
