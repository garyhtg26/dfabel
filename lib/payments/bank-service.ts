import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { db } from "../firebase/admin";
import { ApiError, requireManager, type Identity } from "../firebase/access";
import { uploadPhoto } from "../storage/photos";
import { bankDetails, bankSettingsSchema } from "./manual-policy";
import { signalPaymentChange } from "./service";
import type { BankAccount, StoredBankSettings } from "./manual-types";

export async function readBankDetails(
  branch: string,
  database: Firestore = db(),
) {
  const snap = await database.doc(`settings/${branch}`).get();
  return bankDetails(snap.get("manualPayment"), branch);
}

export async function saveBankDetails(
  branch: string,
  input: BankAccount,
  user: Identity | null,
  database: Firestore = db(),
) {
  requireManager(user);
  const account = bankSettingsSchema.parse(input);
  await database.runTransaction(async (tx) => {
    const ref = database.doc(`settings/${branch}`);
    const prior = await tx.get(ref);
    const existing = prior.get("manualPayment") as
      StoredBankSettings | undefined;
    const identityChanged =
      existing?.bankName !== account.bankName ||
      existing?.accountNumber !== account.accountNumber ||
      existing?.accountHolder !== account.accountHolder;
    tx.set(
      ref,
      {
        manualPayment: {
          ...existing,
          ...account,
          ...(identityChanged ? { qrVersion: "" } : {}),
          version: randomUUID(),
        },
        updatedBy: user!.uid,
      },
      { merge: true },
    );
    signalPaymentChange(tx, database, branch);
  });
  return readBankDetails(branch, database);
}

export async function setBankQr(
  branch: string,
  bytes: Uint8Array | null,
  user: Identity | null,
  database: Firestore = db(),
  upload: typeof uploadPhoto = uploadPhoto,
  expectedVersion?: string,
) {
  requireManager(user);
  const initial = await database.doc(`settings/${branch}`).get();
  if (bytes && !bankDetails(initial.get("manualPayment"), branch).configured)
    throw new ApiError(
      409,
      "Simpan rekening yang lengkap sebelum mengunggah QR pembayaran.",
    );
  const capturedVersion =
    initial.get("manualPayment")?.version || "unconfigured";
  if (expectedVersion !== undefined && expectedVersion !== capturedVersion)
    throw new ApiError(
      409,
      "Rekening telah berubah. Muat ulang sebelum mengunggah QR.",
    );
  const qrVersion = bytes ? randomUUID() : "";
  if (bytes) await upload(`payments/bank-qr/${branch}/${qrVersion}.jpg`, bytes);
  await database.runTransaction(async (tx) => {
    const ref = database.doc(`settings/${branch}`);
    const prior = await tx.get(ref);
    const existing = prior.get("manualPayment") as
      StoredBankSettings | undefined;
    if ((existing?.version || "unconfigured") !== capturedVersion)
      throw new ApiError(
        409,
        "Rekening berubah saat QR diunggah. Periksa rekening dan unggah ulang QR yang sesuai.",
      );
    tx.set(
      ref,
      {
        manualPayment: {
          bankName: existing?.bankName || "BCA",
          accountNumber: existing?.accountNumber || "",
          accountHolder: existing?.accountHolder || "",
          ...existing,
          qrVersion,
          version: randomUUID(),
        },
        updatedBy: user!.uid,
      },
      { merge: true },
    );
    if (qrVersion)
      tx.set(database.doc(`bankQrVersions/${branch}-${qrVersion}`), {
        branchId: branch,
        qrVersion,
      });
    signalPaymentChange(tx, database, branch);
  });
  return readBankDetails(branch, database);
}
