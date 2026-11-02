import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { identity, ApiError, sameOrigin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { readBankDetails } from "@/lib/payments/bank-service";
import { memberBalance } from "@/lib/membership";
import { eligibleMemberDiscount } from "@/lib/membership-eligibility";
import { submitMembershipDeposit } from "@/lib/membership-proof";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    amount: z.number().int().min(100000).max(10000000),
    branch: z.enum(["cinere", "bogor"]),
    senderName: z.string().trim().min(2).max(100),
    proofVersion: z.string().uuid(),
  })
  .strict();
function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : error instanceof z.ZodError
            ? "Deposit minimal Rp100.000."
            : "Membership belum tersedia. Coba lagi.",
    },
    {
      status:
        error instanceof ApiError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    },
  );
}
export async function GET(req: NextRequest) {
  try {
    const user = (await identity(req, true))!;
    const database = db();
    const branch =
      req.nextUrl.searchParams.get("branch") === "bogor" ? "bogor" : "cinere";
    const [wallet, pending, history, bank] = await Promise.all([
      database.doc(`memberships/${user.uid}`).get(),
      database.doc(`membershipDeposits/${user.uid}`).get(),
      database
        .collection(`memberships/${user.uid}/events`)
        .orderBy("createdAt", "desc")
        .limit(30)
        .get(),
      readBankDetails(branch, database),
    ]);
    return NextResponse.json(
      {
        active: wallet.get("active") === true,
        discountEligible: eligibleMemberDiscount(wallet.data()),
        balance: memberBalance(wallet.get("balance")),
        pending:
          pending.get("status") === "pending"
            ? {
                amount: pending.get("amount"),
                branchId: pending.get("branchId"),
                senderName: pending.get("senderName"),
                bank: pending.get("bank"),
                hasProof: typeof pending.get("proofVersion") === "string",
                createdAt: pending.get("createdAt"),
              }
            : null,
        history: history.docs.map((x) => ({ id: x.id, ...x.data() })),
        bank,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = (await identity(req, true))!;
    const input = schema.parse(await req.json());
    const database = db();
    const bank = await readBankDetails(input.branch, database);
    if (!bank.configured)
      throw new ApiError(409, "Rekening toko belum tersedia. Hubungi toko.");
    const requestId = randomUUID();
    await submitMembershipDeposit(database, {
      uid: user.uid,
      requestId,
      ...input,
      name: user.name || "Pelanggan",
      bank: {
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountHolder: bank.accountHolder,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
