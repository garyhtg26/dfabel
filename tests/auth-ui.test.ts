import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/auth-error";

test("auth errors distinguish credentials, popup and authorized-domain failures", () => {
  assert.equal(
    authErrorMessage({ code: "auth/invalid-credential" }),
    "Email atau password tidak cocok.",
  );
  assert.match(
    authErrorMessage({ code: "auth/popup-blocked" }),
    /Popup Google diblokir/,
  );
  assert.match(
    authErrorMessage({ code: "auth/unauthorized-domain" }, "127.0.0.1"),
    /127\.0\.0\.1/,
  );
});

test("unknown auth failures stay actionable without exposing provider details", () => {
  assert.equal(
    authErrorMessage({ code: "auth/internal-error" }),
    "Login belum berhasil. Coba lagi atau atur ulang password.",
  );
});
