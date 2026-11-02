import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Order } from "../../lib/types";
import type {
  PaymentAttempt,
  ProviderTransaction,
} from "../../lib/payments/types";
import {
  finalAmount,
  nextStatus,
  paymentLocked,
  safeQrUrl,
  validateTransaction,
  validSignature,
  providerExpiry,
} from "../../lib/payments/policy";
import {
  applyVerifiedTransaction,
  cancelPayment,
  createPayment,
  paymentView,
  type Gateway,
} from "../../lib/payments/service";
import { ChargeRejectedError } from "../../lib/payments/midtrans";

process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-unit-test-not-a-real-key";
process.env.MIDTRANS_IS_PRODUCTION = "false";
process.env.MIDTRANS_QRIS_ENABLED = "true";
delete process.env.MIDTRANS_MERCHANT_ID;

const baseOrder = (): Order => ({
  id: "DF-ABCDEF123456",
  token: "c7ab13d3-610d-4af1-9d05-79a4c0ef6b18",
  uid: "customer",
  branchId: "cinere",
  name: "Test",
  phone: "+6281200000000",
  service: "wash",
  kg: 10,
  actualKg: 10,
  express: false,
  address: "Private test address",
  lat: -6,
  lng: 106,
  date: "2026-10-30",
  slot: "09.00–12.00",
  notes: "Private",
  photo: "",
  status: 3,
  paid: false,
  shippingFee: 0,
  total: 20000,
  unitPrice: 2000,
  washPrice: 2000,
  source: "web",
  createdAt: new Date().toISOString(),
  history: [],
});
const attempt = (overrides: Partial<PaymentAttempt> = {}): PaymentAttempt => ({
  provider: "midtrans",
  attemptId: "DF-ABCDEF123456-0123456789abcdef0123",
  orderId: "DF-ABCDEF123456",
  branchId: "cinere",
  amount: 20000,
  environment: "sandbox",
  status: "pending",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  ...overrides,
});
const response = (
  value: PaymentAttempt,
  status = "pending",
): ProviderTransaction => ({
  order_id: value.attemptId,
  gross_amount: String(value.amount) + ".00",
  transaction_status: status,
  transaction_id: "gateway-transaction-1",
  status_code: status === "settlement" ? "200" : "201",
  payment_type: "qris",
  currency: "IDR",
  fraud_status: "accept",
  merchant_id: "M123",
  actions: [
    {
      name: "generate-qr-code-v2",
      method: "GET",
      url: "https://api.sandbox.midtrans.com/v4/qris/qr-123/qr-code",
    },
  ],
});

// Serial transactions model Firestore's retry/serialization guarantee without network or credentials.
class MemoryDatabase {
  values = new Map<string, Record<string, unknown>>();
  private queue = Promise.resolve();
  constructor(order = baseOrder()) {
    this.values.set(`orders/${order.id}`, structuredClone(order));
  }
  doc(path: string) {
    return {
      path,
      get: async () => this.snapshot(path),
    };
  }
  snapshot(path: string) {
    const value = this.values.get(path);
    return {
      exists: value !== undefined,
      ref: this.doc(path),
      data: () => (value ? structuredClone(value) : undefined),
      get: (key: string) => value?.[key],
    };
  }
  async runTransaction<T>(callback: (tx: unknown) => Promise<T>) {
    const prior = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    const writes: (() => void)[] = [];
    let hasWrites = false;
    const tx = {
      get: async (ref: { path: string }) => {
        assert.equal(
          hasWrites,
          false,
          "Firestore transaction must read before writing",
        );
        return this.snapshot(ref.path);
      },
      set: (ref: { path: string }, value: Record<string, unknown>) => {
        hasWrites = true;
        writes.push(() => this.values.set(ref.path, structuredClone(value)));
      },
      update: (ref: { path: string }, value: Record<string, unknown>) => {
        hasWrites = true;
        writes.push(() => {
          assert.equal(this.values.has(ref.path), true);
          this.values.set(ref.path, {
            ...this.values.get(ref.path),
            ...structuredClone(value),
          });
        });
      },
      create: (ref: { path: string }, value: Record<string, unknown>) => {
        hasWrites = true;
        writes.push(() => {
          assert.equal(this.values.has(ref.path), false);
          this.values.set(ref.path, structuredClone(value));
        });
      },
    };
    try {
      const result = await callback(tx);
      writes.forEach((write) => write());
      return result;
    } finally {
      release();
    }
  }
  asFirestore() {
    return this as unknown as Firestore;
  }
  order() {
    return this.values.get("orders/DF-ABCDEF123456") as unknown as Order;
  }
}

test("notification signatures reject altered amount, key, and malformed signatures", () => {
  const notification = response(attempt());
  notification.signature_key = createHash("sha512")
    .update(
      notification.order_id +
        notification.status_code +
        notification.gross_amount +
        "secret",
    )
    .digest("hex");
  assert.equal(validSignature(notification, "secret"), true);
  assert.equal(
    validSignature({ ...notification, gross_amount: "100.00" }, "secret"),
    false,
  );
  assert.equal(validSignature(notification, "other-key"), false);
  assert.equal(
    validSignature({ ...notification, signature_key: "not hex" }, "secret"),
    false,
  );
});

test("a provider transaction is bound to exact invoice, amount, transaction, merchant and environment", () => {
  const value = attempt({ transactionId: "gateway-transaction-1" });
  assert.equal(
    validateTransaction(value, response(value), "sandbox", "M123"),
    "pending",
  );
  for (const patch of [
    { order_id: "other" },
    { gross_amount: "1.00" },
    { gross_amount: "2e4" },
    { currency: "USD" },
    { payment_type: "gopay" },
    { transaction_id: "other" },
    { merchant_id: "other" },
  ])
    assert.throws(() =>
      validateTransaction(
        value,
        { ...response(value), ...patch },
        "sandbox",
        "M123",
      ),
    );
  assert.throws(() =>
    validateTransaction(value, response(value), "production"),
  );
  assert.throws(() =>
    validateTransaction(
      value,
      { ...response(value, "settlement"), fraud_status: "challenge" },
      "sandbox",
    ),
  );
});

test("only confirmed server totals can produce a QR and expiry alone never unlocks an active invoice", () => {
  const order = baseOrder();
  assert.equal(finalAmount(order), 20000);
  assert.equal(finalAmount({ ...order, actualKg: null }), null);
  assert.equal(finalAmount({ ...order, shippingFee: null }), null);
  assert.equal(finalAmount({ ...order, total: 1 }), null);
  assert.equal(
    paymentLocked(attempt({ expiresAt: "2020-01-01T00:00:00.000Z" })),
    true,
  );
  assert.equal(nextStatus("paid", "pending"), "paid");
  assert.equal(nextStatus("paid", "expired"), "paid");
  assert.equal(nextStatus("expired", "pending"), "expired");
  assert.equal(nextStatus("expired", "paid"), "paid");
});

test("QR proxy URLs reject foreign hosts, embedded credentials, redirects and mixed environments", () => {
  assert.equal(
    safeQrUrl(
      "https://api.sandbox.midtrans.com/v4/qris/abc-123/qr-code",
      false,
    ),
    "https://api.sandbox.midtrans.com/v4/qris/abc-123/qr-code",
  );
  for (const url of [
    "https://evil.example/v4/qris/id/qr-code",
    "http://api.sandbox.midtrans.com/v4/qris/id/qr-code",
    "https://api.midtrans.com/v4/qris/id/qr-code",
    "https://user:pass@api.sandbox.midtrans.com/v4/qris/id/qr-code",
    "https://api.sandbox.midtrans.com/v4/qris/id/qr-code?redirect=evil",
    "https://api.sandbox.midtrans.com/anything",
  ])
    assert.equal(safeQrUrl(url, false), undefined);
});

test("provider expiry timestamps use Jakarta timezone and reject invalid dates", () => {
  assert.equal(
    providerExpiry("2026-10-30 12:00:00"),
    "2026-10-30T05:00:00.000Z",
  );
  assert.equal(
    providerExpiry("2026-10-30 12:00:00 +0700"),
    "2026-10-30T05:00:00.000Z",
  );
  assert.equal(providerExpiry("not a date"), undefined);
});

test("a QR from another environment is suppressed before any image fetch", async () => {
  const value = attempt({
    environment: "production",
    qrUrl: "https://api.midtrans.com/v4/qris/qr-123/qr-code",
  });
  const database = new MemoryDatabase({ ...baseOrder(), payment: value });
  database.values.set(`paymentAttempts/${value.attemptId}`, value);
  const view = await paymentView(database.order(), database.asFirestore());
  assert.equal(view.payment?.environment, "production");
  assert.equal(view.qrUrl, undefined);
});

test("concurrent create requests reserve exactly one provider invoice", async () => {
  const database = new MemoryDatabase();
  const created: string[] = [];
  const api: Gateway = {
    status: async () => null,
    expire: async () => {},
    create: async (value) => {
      created.push(value.attemptId);
      return response(value);
    },
  };
  await Promise.all([
    createPayment(baseOrder().id, database.asFirestore(), api),
    createPayment(baseOrder().id, database.asFirestore(), api),
  ]);
  assert.equal(created.length, 1);
  assert.equal(
    [...database.values.keys()].filter((key) =>
      key.startsWith("paymentAttempts/"),
    ).length,
    1,
  );
  assert.equal(database.order().payment?.status, "pending");
});

test("a timeout stays locked and recovery reuses the original provider order ID", async () => {
  const database = new MemoryDatabase();
  const ids: string[] = [];
  let failing = true;
  const api: Gateway = {
    status: async () => null,
    expire: async () => {},
    create: async (value) => {
      ids.push(value.attemptId);
      if (failing) throw Error("simulated timeout");
      return response(value);
    },
  };
  await assert.rejects(
    createPayment(baseOrder().id, database.asFirestore(), api),
  );
  assert.equal(database.order().payment?.status, "creating");
  const key = `paymentAttempts/${database.order().payment?.attemptId}`;
  database.values.set(key, {
    ...database.values.get(key),
    updatedAt: new Date(Date.now() - 20000).toISOString(),
  });
  failing = false;
  await createPayment(baseOrder().id, database.asFirestore(), api);
  assert.deepEqual(ids, [ids[0], ids[0]]);
  assert.equal(database.order().payment?.status, "pending");
});

test("definite first charge rejection unlocks only when status lookup confirms not found", async () => {
  const database = new MemoryDatabase();
  const api: Gateway = {
    status: async () => null,
    expire: async () => {},
    create: async () => {
      throw new ChargeRejectedError();
    },
  };
  await assert.rejects(
    createPayment(baseOrder().id, database.asFirestore(), api),
  );
  assert.equal(database.order().payment?.status, "failed");
  const uncertain = new MemoryDatabase();
  api.status = async () => {
    throw Error("status lookup failed");
  };
  await assert.rejects(
    createPayment(baseOrder().id, uncertain.asFirestore(), api),
  );
  assert.equal(uncertain.order().payment?.status, "creating");
});

test("repeated notifications and later pending/expired notifications never regress a settled order", async () => {
  const value = attempt();
  const database = new MemoryDatabase({ ...baseOrder(), payment: value });
  database.values.set(`paymentAttempts/${value.attemptId}`, value);
  await applyVerifiedTransaction(
    value.attemptId,
    response(value, "settlement"),
    database.asFirestore(),
  );
  await applyVerifiedTransaction(
    value.attemptId,
    response(value, "settlement"),
    database.asFirestore(),
  );
  await applyVerifiedTransaction(
    value.attemptId,
    response(value, "pending"),
    database.asFirestore(),
  );
  await applyVerifiedTransaction(
    value.attemptId,
    response(value, "expire"),
    database.asFirestore(),
  );
  assert.equal(database.order().paid, true);
  assert.equal(database.order().payment?.status, "paid");
  await assert.rejects(
    applyVerifiedTransaction(
      value.attemptId,
      { ...response(value, "settlement"), gross_amount: "1.00" },
      database.asFirestore(),
    ),
  );
  assert.equal(database.order().paid, true);
});

test("late payment on a superseded invoice is recorded and flags review without overwriting a new amount", async () => {
  const old = attempt({ status: "expired" });
  const current = attempt({
    attemptId: "DF-ABCDEF123456-abcdef0123456789abcd",
    amount: 40000,
  });
  const database = new MemoryDatabase({
    ...baseOrder(),
    total: 40000,
    payment: current,
  });
  database.values.set(`paymentAttempts/${old.attemptId}`, old);
  database.values.set(`paymentAttempts/${current.attemptId}`, current);
  await applyVerifiedTransaction(
    old.attemptId,
    response(old, "settlement"),
    database.asFirestore(),
  );
  assert.equal(
    database.values.get(`paymentAttempts/${old.attemptId}`)?.status,
    "paid",
  );
  assert.equal(
    database.values.get(`paymentAttempts/${old.attemptId}`)
      ?.reconciliationRequired,
    true,
  );
  assert.equal(database.order().paymentReconciliationRequired, true);
  assert.equal(database.order().payment?.attemptId, current.attemptId);
  assert.equal(database.order().total, 40000);
  assert.equal(database.order().paid, false);
});

test("verified refund states preserve settlement history and flag financial review", async () => {
  const value = attempt();
  const database = new MemoryDatabase({
    ...baseOrder(),
    payment: value,
    pointsEarned: 2000,
  });
  database.values.set(`paymentAttempts/${value.attemptId}`, value);
  await applyVerifiedTransaction(
    value.attemptId,
    response(value, "settlement"),
    database.asFirestore(),
  );
  await applyVerifiedTransaction(
    value.attemptId,
    { ...response(value, "partial_refund"), status_code: "200" },
    database.asFirestore(),
  );
  assert.equal(database.order().paid, true);
  assert.equal(database.order().payment?.status, "paid");
  assert.equal(database.order().paymentReconciliationRequired, true);
  assert.equal(
    database.values.get("loyalty/customer")?.reconciliationRequired,
    true,
  );
  assert.equal(
    database.values.get(`paymentAttempts/${value.attemptId}`)?.providerState,
    "partial_refund",
  );
  assert.equal(
    database.values.get(`paymentAttempts/${value.attemptId}`)
      ?.reconciliationRequired,
    true,
  );
});

test("cancellation only unlocks after authoritative provider status confirms expiry", async () => {
  const value = attempt();
  const database = new MemoryDatabase({ ...baseOrder(), payment: value });
  database.values.set(`paymentAttempts/${value.attemptId}`, value);
  let state = "pending";
  const api: Gateway = {
    status: async () => response(value, state),
    create: async () => response(value),
    expire: async () => {
      state = "expire";
    },
  };
  const view = await cancelPayment(baseOrder().id, database.asFirestore(), api);
  assert.equal(view.payment?.status, "expired");
  assert.equal(paymentLocked(view.payment), false);
  database.values.set("orders/DF-ABCDEF123456", {
    ...baseOrder(),
    payment: value,
  });
  database.values.set(`paymentAttempts/${value.attemptId}`, value);
  api.status = async () => null;
  await assert.rejects(
    cancelPayment(baseOrder().id, database.asFirestore(), api),
  );
  assert.equal(paymentLocked(database.order().payment), true);
});
