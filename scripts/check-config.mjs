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
const midtransKey = process.env.MIDTRANS_SERVER_KEY?.trim();
const midtransMode = process.env.MIDTRANS_IS_PRODUCTION?.trim() || "false";
const midtransCheckout = process.env.MIDTRANS_QRIS_ENABLED?.trim() || "false";
if (!["true", "false"].includes(midtransCheckout)) {
  console.error("MIDTRANS_QRIS_ENABLED must be true or false.");
  process.exit(1);
}
if (!["true", "false"].includes(midtransMode)) {
  console.error("MIDTRANS_IS_PRODUCTION must be true or false.");
  process.exit(1);
}
if (!midtransKey) {
  console.log(
    "QRIS is disabled: add MIDTRANS_SERVER_KEY and explicitly set MIDTRANS_QRIS_ENABLED=true when the merchant is ready.",
  );
} else if (
  midtransMode === "false" &&
  !/^SB-Mid-server-\S+$/.test(midtransKey)
) {
  console.error("Sandbox mode requires a Midtrans Sandbox Server Key.");
  process.exit(1);
} else if (midtransMode === "true" && !/^Mid-server-\S+$/.test(midtransKey)) {
  console.error("Production mode requires a Midtrans Production Server Key.");
  process.exit(1);
} else {
  console.log(
    `Midtrans ${midtransMode === "true" ? "production" : "sandbox"} configuration detected. Merchant activation and live payment are not verified.`,
  );
}
if (midtransCheckout === "false")
  console.log(
    "QRIS checkout is coming soon. Manual transfer settings are managed by owner/admin in the dashboard.",
  );
