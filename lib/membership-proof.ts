import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { ApiError } from "./firebase/access";
import { uploadPhoto } from "./storage/photos";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function membershipProofPath(uid: string, version: string) {
  if (!uid || !uuid.test(version))
    throw new ApiError(400, "Bukti transfer tidak valid.");
  const userHash = createHash("sha256").update(uid).digest("hex");
  return `membership/proofs/${userHash}/${version.toLowerCase()}.jpg`;
}

export async function storeMembershipProof(
  database: Firestore,
  uid: string,
  bytes: Uint8Array,
  upload: typeof uploadPhoto = uploadPhoto,
) {
  await database.runTransaction(async (tx) => {
    const depositRef = database.doc(`membershipDeposits/${uid}`);
    const rateRef = database.doc(`membershipProofLimits/${uid}`);
    const [deposit, rate] = await Promise.all([
      tx.get(depositRef),
      tx.get(rateRef),
    ]);
    if (deposit.get("status") === "pending")
      throw new ApiError(
        409,
        "Deposit sebelumnya masih menunggu pemeriksaan toko.",
      );
    const now = Date.now();
    const recent = ((rate.get("uploads") || []) as number[]).filter(
      (time) => Number.isFinite(time) && time > now - 3600000,
    );
    if (recent.length >= 12)
      throw new ApiError(429, "Terlalu banyak unggahan. Coba lagi nanti.");
    tx.set(rateRef, { uploads: [...recent, now] });
  });
  const version = randomUUID();
  await upload(membershipProofPath(uid, version), bytes);
  await database.runTransaction(async (tx) => {
    const deposit = await tx.get(database.doc(`membershipDeposits/${uid}`));
    if (deposit.get("status") === "pending")
      throw new ApiError(
        409,
        "Deposit sebelumnya masih menunggu pemeriksaan toko.",
      );
    tx.set(database.doc(`membershipProofs/${uid}`), {
      version,
      uploadedAt: new Date().toISOString(),
    });
  });
  return { proofVersion: version };
}

export async function submitMembershipDeposit(
  database: Firestore,
  input: {
    uid: string;
    requestId: string;
    proofVersion: string;
    amount: number;
    branch: string;
    name: string;
    senderName: string;
    bank: { bankName: string; accountNumber: string; accountHolder: string };
  },
) {
  await database.runTransaction(async (tx) => {
    const ref = database.doc(`membershipDeposits/${input.uid}`);
    const proofRef = database.doc(`membershipProofs/${input.uid}`);
    const [deposit, proof] = await Promise.all([tx.get(ref), tx.get(proofRef)]);
    if (deposit.get("status") === "pending")
      throw new ApiError(
        409,
        "Masih ada deposit yang menunggu pemeriksaan toko.",
      );
    if (!proof.exists || proof.get("version") !== input.proofVersion)
      throw new ApiError(
        409,
        "Unggah bukti transfer terbaru sebelum mengajukan deposit.",
      );
    tx.set(ref, {
      uid: input.uid,
      requestId: input.requestId,
      amount: input.amount,
      branchId: input.branch,
      status: "pending",
      name: input.name,
      senderName: input.senderName,
      proofVersion: input.proofVersion,
      createdAt: new Date().toISOString(),
      bank: input.bank,
    });
    tx.delete(proofRef);
  });
}
