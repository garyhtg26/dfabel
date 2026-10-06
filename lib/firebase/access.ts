import "server-only";
import type { NextRequest } from "next/server";
import { adminAuth, firebaseReady } from "./admin";
import { adminEmailAllowed } from "../access-policy";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Identity = {
  uid: string;
  email: string;
  name: string;
  admin: boolean;
};
export async function identity(
  req: NextRequest,
  required = false,
): Promise<Identity | null> {
  const header = req.headers.get("authorization");
  if (!header) {
    if (required)
      throw new ApiError(401, "Silakan masuk dengan Google terlebih dahulu.");
    return null;
  }
  if (!firebaseReady())
    throw new ApiError(503, "Firebase belum dikonfigurasi.");
  try {
    if (!header.startsWith("Bearer ")) throw Error();
    const token = await adminAuth().verifyIdToken(header.slice(7), true);
    if (
      !token.email_verified ||
      token.firebase.sign_in_provider !== "google.com"
    )
      throw Error();
    const email = (token.email || "").toLowerCase();
    return {
      uid: token.uid,
      email,
      name: token.name || "",
      admin: adminEmailAllowed(
        email,
        !!token.email_verified,
        process.env.ADMIN_EMAILS || "",
      ),
    };
  } catch {
    throw new ApiError(
      401,
      "Sesi tidak valid atau kedaluwarsa. Silakan masuk kembali.",
    );
  }
}
export function requireAdmin(user: Identity | null) {
  if (!user?.admin) throw new ApiError(403, "Akses khusus admin toko.");
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    throw new ApiError(403, "Origin tidak diizinkan.");
}
