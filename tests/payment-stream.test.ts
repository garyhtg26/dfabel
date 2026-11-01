import test from "node:test";
import assert from "node:assert/strict";
import { consumePaymentEvents } from "../lib/payment-stream";

function eventResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

test("payment updates survive split network chunks and heartbeat comments", async () => {
  const events: { event: string; data: unknown }[] = [];
  await consumePaymentEvents(
    eventResponse([
      ": heartbeat\r\n\r\neve",
      'nt: payment\r\ndata: {"paid":tr',
      'ue,"amount":20000}\r\n\r',
      '\nevent: refresh\ndata: {"branch":"cinere"}\n\n',
    ]),
    (event, data) => events.push({ event, data }),
  );
  assert.deepEqual(events, [
    { event: "payment", data: { paid: true, amount: 20000 } },
    { event: "refresh", data: { branch: "cinere" } },
  ]);
});

test("a malformed payment event does not suppress a later verified update", async () => {
  const events: unknown[] = [];
  await consumePaymentEvents(
    eventResponse([
      "event: payment\ndata: not-json\n\n",
      'event: payment\ndata: {"paid":\ndata: true}\n\n',
    ]),
    (_event, data) => events.push(data),
  );
  assert.deepEqual(events, [{ paid: true }]);
});

test("event consumers reject failed HTTP responses and oversized partial events", async () => {
  await assert.rejects(
    consumePaymentEvents(new Response("denied", { status: 403 }), () => {}),
    /terputus/,
  );
  await assert.rejects(
    consumePaymentEvents(eventResponse(["x".repeat(100_001)]), () => {}),
    /tidak valid/,
  );
});
