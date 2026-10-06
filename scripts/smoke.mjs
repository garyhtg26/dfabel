import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://127.0.0.1:3000";
for (const path of ["/", "/dashboard"]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
}
const publicResponse = await fetch(base + "/api/store");
assert.equal(publicResponse.status, 200);
const store = await publicResponse.json();
assert.equal(
  store.orders.length,
  0,
  "Anonymous requests must not expose orders",
);
assert.equal(store.isAdmin, false);
const write = await fetch(base + "/api/store", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "order", data: {} }),
});
assert.ok([401, 503].includes(write.status), "Anonymous write rejected");
const forged = await fetch(base + "/api/store", {
  headers: { Authorization: "Bearer forged" },
});
assert.ok([401, 503].includes(forged.status), "Forged token rejected");
const track = await fetch(base + "/api/tracking?token=DF-1234");
assert.equal(
  track.status,
  400,
  "Public tracking requires unguessable link token",
);
const photo = await fetch(base + "/api/orders/DF-123456789012/photo");
assert.equal(photo.status, 401, "Photo requires authentication");
console.log(
  "PASS: customer/dashboard routes, public catalog, no anonymous order data, anonymous writes and forged tokens rejected, tracking and photo boundaries.",
);
