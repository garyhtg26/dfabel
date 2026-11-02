import { createHash, randomBytes } from "node:crypto";
import { eligibleMemberDiscount } from "./membership-eligibility";

export const MEMBER_CODE_LIFETIME_MS = 5 * 60 * 1000;
export const memberCodePattern = /^[A-F0-9]{10}$/;
export function newMemberCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}
export function memberCodeHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
export function validMemberCode(
  record: Record<string, unknown> | undefined,
  branch: string,
  now: number,
) {
  return (
    !!record &&
    typeof record.uid === "string" &&
    record.uid.length > 0 &&
    record.branchId === branch &&
    typeof record.expiresAt === "number" &&
    record.expiresAt > now &&
    !record.usedAt
  );
}
export function validMemberWallet(
  wallet: Record<string, unknown> | undefined,
  hash: string,
) {
  return (
    eligibleMemberDiscount(wallet) && !!wallet && wallet.activeCodeHash === hash
  );
}
