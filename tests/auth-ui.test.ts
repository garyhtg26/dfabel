import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/auth-error";
import {
  isPhoneLogin,
  phoneFromLoginEmail,
  phoneLoginEmail,
} from "../lib/phone-auth";

test("phone login normalizes Indonesian numbers and requires a server-issued claim", () => {
  const internal = phoneLoginEmail("0812 3456 7890");
  assert.equal(internal, "wa-6281234567890@accounts.dfable.invalid");
  assert.equal(phoneLoginEmail("+6281234567890"), internal);
  assert.equal(phoneLoginEmail("021123456"), null);
  assert.equal(phoneFromLoginEmail(internal), "+6281234567890");
  assert.equal(isPhoneLogin(internal, "password", true), true);
  assert.equal(isPhoneLogin(internal, "password", false), false);
  assert.equal(isPhoneLogin(internal, "google.com", true), false);
  assert.equal(isPhoneLogin("user@example.com", "password", true), false);
});

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
