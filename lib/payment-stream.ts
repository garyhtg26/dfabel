/** Read server-sent events without putting an authentication token in a URL. */
export async function consumePaymentEvents(
  response: Response,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  if (
    !response.ok ||
    !response.body ||
    !response.headers.get("Content-Type")?.includes("text/event-stream")
  )
    throw new Error("Pembaruan pembayaran sementara terputus.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];
  const line = (value: string) => {
    if (value === "") {
      if (data.length) {
        try {
          onEvent(event, JSON.parse(data.join("\n")));
        } catch {
          // Ignore malformed events. A later event or status check can recover.
        }
      }
      event = "message";
      data = [];
    } else if (value.startsWith("event:")) {
      event = value.slice(6).trim();
    } else if (value.startsWith("data:")) {
      data.push(value.slice(5).replace(/^ /, ""));
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, end).replace(/\r$/, ""));
        buffer = buffer.slice(end + 1);
      }
      if (buffer.length > 100_000) throw new Error("Pembaruan tidak valid.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
