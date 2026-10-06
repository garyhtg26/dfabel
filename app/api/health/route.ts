import { NextResponse } from "next/server";
import { db, firebaseReady } from "@/lib/firebase/admin";
import { serverFailure } from "@/lib/server-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!firebaseReady())
    return NextResponse.json({ status: "setup_required" }, { status: 503 });
  try {
    await db().doc("settings/cinere").get();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("D’Fable health failure", serverFailure(error));
    return NextResponse.json(
      { status: "database_unavailable" },
      { status: 503 },
    );
  }
}
