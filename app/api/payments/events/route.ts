import { NextRequest } from "next/server";
import { branchSchema } from "@/lib/branches";
import { identity, requireAdmin } from "@/lib/firebase/access";
import { db } from "@/lib/firebase/admin";
import { authorizePayment, paymentFailure } from "@/lib/payments/http";
import { paymentView } from "@/lib/payments/service";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch");
    let documentPath: string;
    let event: "refresh" | "payment";
    if (branch !== null) {
      requireAdmin(await identity(req, true));
      documentPath = `paymentSignals/${branchSchema.parse(branch)}`;
      event = "refresh";
    } else {
      const { order } = await authorizePayment(
        req,
        req.nextUrl.searchParams.get("orderId") || "",
        req.nextUrl.searchParams.get("token"),
      );
      documentPath = `orders/${order.id}`;
      event = "payment";
    }
    const encoder = new TextEncoder();
    let stop = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let unsubscribe = () => {};
        let timeout: ReturnType<typeof setTimeout>;
        let heartbeat: ReturnType<typeof setInterval>;
        const cleanup = () => {
          unsubscribe();
          clearTimeout(timeout);
          clearInterval(heartbeat);
          req.signal.removeEventListener("abort", close);
        };
        const close = () => {
          if (closed) return;
          closed = true;
          cleanup();
          try {
            controller.close();
          } catch {
            /* Client already disconnected. */
          }
        };
        stop = close;
        const send = (value: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(value));
          } catch {
            close();
          }
        };
        if (req.signal.aborted) {
          close();
          return;
        }
        req.signal.addEventListener("abort", close, { once: true });
        send("retry: 3000\n\n");
        heartbeat = setInterval(() => send(": keepalive\n\n"), 10000);
        // Bounded streams work with Vercel's serverless lifetime. Clients reconnect.
        timeout = setTimeout(close, 25000);
        let sequence = 0;
        unsubscribe = db()
          .doc(documentPath)
          .onSnapshot(
            async (snapshot) => {
              const current = ++sequence;
              try {
                if (event === "refresh") {
                  send(
                    `event: refresh\ndata: ${JSON.stringify({ branch })}\n\n`,
                  );
                } else if (snapshot.exists) {
                  const view = await paymentView(snapshot.data() as Order);
                  if (current === sequence)
                    send(`event: payment\ndata: ${JSON.stringify(view)}\n\n`);
                } else close();
              } catch {
                close();
              }
            },
            () => close(),
          );
        if (closed) unsubscribe();
      },
      cancel() {
        stop();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-cache, no-store, no-transform",
        "X-Accel-Buffering": "no",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return paymentFailure(error);
  }
}
