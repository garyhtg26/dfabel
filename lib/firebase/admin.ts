import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
export const firebaseReady = () =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
export function adminApp() {
  if (!firebaseReady()) throw new Error("FIREBASE_NOT_CONFIGURED");
  return (
    getApps().find((a) => a.name === "dfable-admin") ||
    initializeApp(
      {
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        }),
      },
      "dfable-admin",
    )
  );
}
export const db = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
