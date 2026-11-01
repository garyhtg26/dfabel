import test from "node:test";
import assert from "node:assert/strict";
import { requestBranchStore } from "../lib/branch-loading";

test("a stalled branch response stops blocking the page and returns a retryable error", async () => {
  let aborted = false;
  const load = requestBranchStore(
    async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
    "bogor",
    undefined,
    20,
  );

  await assert.rejects(load, /Koneksi belum merespons/);
  assert.equal(aborted, true);
});

test("branch requests carry the selected branch and a no-cache policy", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const result = await requestBranchStore(async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return Response.json({ branchId: "cinere" });
  }, "cinere");

  assert.equal(requestUrl, "/api/store?branch=cinere");
  assert.equal(requestInit?.cache, "no-store");
  assert.deepEqual(result, { branchId: "cinere" });
});
