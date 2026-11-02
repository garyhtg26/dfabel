import { NextRequest, NextResponse } from "next/server";
import { identity, ApiError } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = (await identity(req, true))!;
    const database = db();
    const wallet = database.doc(`loyalty/${user.uid}`);
    const [snap, events] = await Promise.all([
      wallet.get(),
      database
        .collection(`loyalty/${user.uid}/events`)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
    ]);
    const balance = snap.get("balance") ?? 0;
    if (!Number.isSafeInteger(balance) || balance < 0)
      throw Error("Invalid loyalty balance");
    return NextResponse.json(
      {
        balance,
        reconciliationRequired: snap.get("reconciliationRequired") === true,
        history: events.docs.map((event) => ({
          id: event.id,
          ...event.data(),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : "Poin belum bisa dimuat. Coba lagi.",
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
