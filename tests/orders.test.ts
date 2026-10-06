import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePrice, normalizePhone } from "../lib/pricing";
import { adminEmailAllowed } from "../lib/access-policy";
import { orderSchema, pricesSchema } from "../lib/order-validation";
import { publicTracking } from "../lib/tracking-data";
import type { Order } from "../lib/types";
test("Cinere package minimum, excess kilograms, ironing and express use expected prices", () => {
  assert.equal(calculatePrice("wash", 5, 2000, 2000, false), 20000);
  assert.equal(calculatePrice("wash", 12, 2000, 2000, false), 24000);
  assert.equal(calculatePrice("complete", 5, 6000, 2000, false), 40000);
  assert.equal(calculatePrice("complete", 12, 6000, 2000, true), 108000);
  assert.equal(calculatePrice("iron", 2.5, 4000, 2000, false), 10000);
});
test("phone format is normalized and invalid dates or weights are rejected", () => {
  assert.equal(normalizePhone("0812 0000 0000"), "+6281200000000");
  const data = {
    requestId: "9f45378a-c849-451e-b399-0fbc76ed6d0a",
    name: "Test Customer",
    phone: "081200000000",
    service: "wash",
    kg: 10,
    express: false,
    address: "Alamat contoh Cinere",
    lat: -6.3286,
    lng: 106.7844,
    date: "2026-10-07",
    slot: "09.00–12.00",
    notes: "",
    photo: "",
    source: "web",
  };
  assert.equal(orderSchema.parse(data).phone, "+6281200000000");
  for (const patch of [
    { kg: -1 },
    { kg: 101 },
    { date: "2026-02-31" },
    { phone: "12345" },
    { lat: 91 },
    { requestId: "x" },
  ])
    assert.equal(orderSchema.safeParse({ ...data, ...patch }).success, false);
});
test("admin allowlist never accepts unverified, empty or wildcard matches", () => {
  assert.equal(
    adminEmailAllowed(" ADMIN@example.com ", true, "admin@example.com"),
    true,
  );
  assert.equal(
    adminEmailAllowed("admin@example.com", false, "admin@example.com"),
    false,
  );
  assert.equal(
    adminEmailAllowed("someone@example.com", true, "*@example.com"),
    false,
  );
  assert.equal(adminEmailAllowed("", true, ""), false);
});
test("public tracking excludes customer PII, coordinates, photos, auth UID and token", () => {
  const order = {
    id: "DF-ABC123",
    branchId: "cinere",
    unitPrice: 2000,
    washPrice: 2000,
    source: "web",
    token: "secret",
    uid: "customer",
    name: "Private",
    phone: "Private",
    address: "Private",
    lat: -6,
    lng: 106,
    photo: "private.jpg",
    photoPath: "private",
    notes: "Private",
    service: "wash",
    kg: 10,
    actualKg: 10,
    express: false,
    status: 6,
    paid: true,
    total: 20000,
    shippingFee: 0,
    date: "2026-10-07",
    slot: "09.00–12.00",
    history: [],
    createdAt: "2026-10-06",
  } as Order;
  const output = publicTracking(order);
  assert.equal(output.status, 6);
  for (const key of [
    "token",
    "uid",
    "name",
    "phone",
    "address",
    "lat",
    "lng",
    "photo",
    "photoPath",
    "notes",
  ])
    assert.equal(key in output, false);
});
test("price changes require four unique valid services and sensible package pricing", () => {
  const prices = [
    { id: "complete", price: 6000 },
    { id: "wash", price: 2000 },
    { id: "iron", price: 4000 },
    { id: "member", price: 150000 },
  ];
  assert.equal(pricesSchema.safeParse(prices).success, true);
  assert.equal(
    pricesSchema.safeParse([...prices.slice(0, 3), prices[0]]).success,
    false,
  );
  assert.equal(
    pricesSchema.safeParse(
      prices.map((p) => (p.id === "complete" ? { ...p, price: 1000 } : p)),
    ).success,
    false,
  );
});
