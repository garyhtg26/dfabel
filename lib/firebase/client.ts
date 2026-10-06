"use client";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { authAppName, type AuthScope } from "../auth-ui";
export const clientReady = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);
export function clientAuth(scope: AuthScope = "customer") {
  if (!clientReady) throw Error("Login belum dikonfigurasi.");
  const app =
    getApps().find((app) => app.name === authAppName(scope)) ||
    initializeApp(
      {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
      authAppName(scope),
    );
  const auth = getAuth(app);
  auth.languageCode = "id";
  return auth;
}
