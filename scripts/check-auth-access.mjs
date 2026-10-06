import nextEnv from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
nextEnv.loadEnvConfig(process.cwd());
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app),
  db = getFirestore(app),
  created = [];
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const prefix = "dfable-test-" + randomBytes(6).toString("hex");
const password = randomBytes(24).toString("base64url");
async function login(email) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  assert.equal(r.status, 200, "Email/password sign-in failed");
  return (await r.json()).idToken;
}
async function request(token, path = "/api/admin/users", data) {
  return fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-DFable-Surface": "admin",
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
try {
  for (const role of ["admin", "staff", "customer"]) {
    const u = await auth.createUser({
      email: `${prefix}-${role}@example.com`,
      password,
      emailVerified: true,
    });
    created.push(u.uid);
    await db.doc(`access/${u.uid}`).set({ role, disabled: false });
  }
  const [admin, staff, customer] = await Promise.all(
    ["admin", "staff", "customer"].map((role) =>
      login(`${prefix}-${role}@example.com`),
    ),
  );
  assert.equal((await request(admin)).status, 200, "Admin can list users");
  assert.equal((await request(staff)).status, 403, "Staff cannot manage users");
  assert.equal(
    (await request(customer)).status,
    403,
    "Customer cannot manage users",
  );
  assert.equal(
    (
      await request(admin, "/api/admin/users", {
        action: "delete",
        uid: created[0],
      })
    ).status,
    403,
    "Self deletion denied",
  );
  assert.equal(
    (await request(staff, "/api/store", { action: "prices", data: [] })).status,
    403,
    "Staff cannot edit prices",
  );
  for (const [token, expected] of [
    [admin, true],
    [staff, true],
    [customer, false],
  ]) {
    const r = await request(token, "/api/store");
    if (token === customer && r.status === 500) {
      console.log(
        "BLOCKED: customer order query needs Firestore composite index.",
      );
      process.exitCode = 1;
      continue;
    }
    assert.equal(r.status, 200, "Store must load");
    const s = await r.json();
    assert.equal(s.isAdmin, expected);
  }
  const email = `${prefix}-created@example.com`;
  assert.equal(
    (
      await request(admin, "/api/admin/users", {
        action: "create",
        name: "Disposable test",
        email,
        password,
        role: "staff",
      })
    ).status,
    200,
    "Create user",
  );
  const target = await auth.getUserByEmail(email);
  created.push(target.uid);
  assert.equal(target.emailVerified, false, "New users must verify email");
  assert.equal(
    (
      await request(admin, "/api/admin/users", {
        action: "access",
        uid: target.uid,
        role: "customer",
        disabled: true,
      })
    ).status,
    200,
    "Disable and revoke access",
  );
  assert.equal((await auth.getUser(target.uid)).disabled, true);
  assert.equal(
    (
      await request(admin, "/api/admin/users", {
        action: "delete",
        uid: target.uid,
      })
    ).status,
    200,
    "Delete test user",
  );
  console.log(
    "PASS: email/password sign-in; admin/staff/customer access; self-protection; create, revoke, disable and delete user.",
  );
} finally {
  for (const uid of created) {
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      if (e.code !== "auth/user-not-found")
        console.error("Test auth cleanup failed");
    }
    await db.doc(`access/${uid}`).delete();
    await db.doc(`users/${uid}`).delete();
  }
  await db.terminate();
  console.log("Disposable test accounts and access records removed.");
}
