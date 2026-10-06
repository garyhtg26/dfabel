import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { createPrivateKey } from "node:crypto";
loadEnvConfig(process.cwd());
const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "ADMIN_EMAILS",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(
    "Configuration needed (values are never printed):\n" +
      missing.map((k) => "- " + k).join("\n"),
  );
  process.exit(1);
}
if (
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !==
  process.env.FIREBASE_PROJECT_ID
) {
  console.error("Client and server Firebase project IDs must match.");
  process.exit(1);
}
try {
  createPrivateKey(process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"));
} catch {
  console.error("FIREBASE_PRIVATE_KEY must be a valid PEM private key.");
  process.exit(1);
}
if (
  !process.env.ADMIN_EMAILS.split(",").every((v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  )
) {
  console.error(
    "ADMIN_EMAILS must contain comma-separated Google email addresses.",
  );
  process.exit(1);
}
console.log(
  "Configuration structure passes. This does not verify Firebase permissions, APIs, deployed rules or live authentication.",
);
