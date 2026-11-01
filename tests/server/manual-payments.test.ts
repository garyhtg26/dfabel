import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import type { Order } from "../../lib/types";
import type { Identity } from "../../lib/firebase/access";
import {
  bankDetails,
  bankSettingsSchema,
  manualLocked,
  safeManualSummary,
} from "../../lib/payments/manual-policy";
import { saveBankDetails, setBankQr } from "../../lib/payments/bank-service";
import {
  selectManualPayment,
  storeManualProof,
  submitManualPayment,
  reviewManualPayment,
  confirmManualPayment,
} from "../../lib/payments/manual-service";
import { createPayment, type Gateway } from "../../lib/payments/service";
import { publicTracking } from "../../lib/tracking-data";

process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-unit-test-not-a-real-key";
process.env.MIDTRANS_IS_PRODUCTION = "false";
process.env.MIDTRANS_QRIS_ENABLED = "true";
delete process.env.MIDTRANS_MERCHANT_ID;

const account = {
  bankName: "BCA",
  accountNumber: "1234567890",
  accountHolder: "TEST MERCHANT",
};
const owner: Identity = {
  uid: "owner",
  email: "owner@example.test",
  name: "Owner",
  admin: true,
  manageUsers: true,
  role: "owner",
};
const staff: Identity = {
  ...owner,
  uid: "staff",
  manageUsers: false,
  role: "staff",
};
const customer: Identity = {
  ...owner,
  uid: "customer",
  admin: false,
  manageUsers: false,
  role: "customer",
};
const order = (): Order => ({
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

class MemoryDatabase {
  values = new Map<string, Record<string, unknown>>();
  private queue = Promise.resolve();
  constructor(value = order()) {
    this.values.set(`orders/${value.id}`, structuredClone(value));
    this.values.set("settings/cinere", {
      manualPayment: account,
      promo: { active: true },
    });
  }
  doc(path: string) {
    return { path, get: async () => this.snapshot(path) };
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
    let writing = false;
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: { path: string }) => {
        assert.equal(writing, false, "Firestore reads must precede writes");
        return this.snapshot(ref.path);
      },
      set: (
        ref: { path: string },
        value: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        writing = true;
        writes.push(() =>
          this.values.set(
            ref.path,
            options?.merge
              ? { ...this.values.get(ref.path), ...structuredClone(value) }
              : structuredClone(value),
          ),
        );
      },
      update: (ref: { path: string }, value: Record<string, unknown>) => {
        writing = true;
        writes.push(() => {
          assert.equal(this.values.has(ref.path), true);
          this.values.set(ref.path, {
            ...this.values.get(ref.path),
            ...structuredClone(value),
          });
        });
      },
      create: (ref: { path: string }, value: Record<string, unknown>) => {
        writing = true;
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
  firestore() {
    return this as unknown as Firestore;
  }
  current() {
    return this.values.get(`orders/${order().id}`) as unknown as Order;
  }
}
const upload = async () => {};
async function proof(database: MemoryDatabase) {
  await selectManualPayment(order().id, database.firestore());
  const view = await storeManualProof(
    order().id,
    new Uint8Array([1]),
    database.firestore(),
    upload,
  );
  return view.manual!.proofVersion!;
}
async function submitted(database: MemoryDatabase) {
  const version = await proof(database);
  await submitManualPayment(order().id, version, database.firestore());
  return version;
}

test("default bank has no fabricated usable account and account input is validated", () => {
  assert.deepEqual(bankDetails(undefined, "cinere"), {
    bankName: "BCA",
    accountNumber: "",
    accountHolder: "",
    configured: false,
  });
  assert.equal(
    bankSettingsSchema.safeParse({ ...account, accountNumber: "abc" }).success,
    false,
  );
  assert.equal(
    bankSettingsSchema.safeParse({ ...account, qrUrl: "https://evil.test" })
      .success,
    false,
  );
});

test("a payment QR cannot be published before its bank account is complete", async () => {
  const database = new MemoryDatabase();
  database.values.set("settings/cinere", {
    manualPayment: {
      bankName: "BCA",
      accountNumber: "",
      accountHolder: "",
    },
  });
  let uploaded = false;
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      async () => {
        uploaded = true;
      },
    ),
    /Simpan rekening yang lengkap/,
  );
  assert.equal(uploaded, false);
});

test("only owner/admin may edit bank and QR; branch settings stay independent", async () => {
  const database = new MemoryDatabase();
  for (const user of [staff, customer, null]) {
    await assert.rejects(
      saveBankDetails("cinere", account, user, database.firestore()),
      /pemilik/,
    );
    await assert.rejects(
      setBankQr(
        "cinere",
        new Uint8Array([1]),
        user,
        database.firestore(),
        upload,
      ),
      /pemilik/,
    );
  }
  await saveBankDetails(
    "bogor",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  assert.equal(
    (database.values.get("settings/cinere")?.manualPayment as typeof account)
      .accountNumber,
    "1234567890",
  );
  assert.equal(
    (database.values.get("settings/bogor")?.manualPayment as typeof account)
      .accountNumber,
    "9876543210",
  );
  await saveBankDetails("cinere", account, owner, database.firestore());
  assert.deepEqual(database.values.get("settings/cinere")?.promo, {
    active: true,
  });
});

test("selecting bank snapshots destination and its immutable QR across later settings changes", async () => {
  const database = new MemoryDatabase();
  const first = await setBankQr(
    "cinere",
    new Uint8Array([1]),
    owner,
    database.firestore(),
    upload,
  );
  const selected = await selectManualPayment(order().id, database.firestore());
  await saveBankDetails(
    "cinere",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  await setBankQr(
    "cinere",
    new Uint8Array([2]),
    owner,
    database.firestore(),
    upload,
  );
  const version = await proof(database);
  const view = await submitManualPayment(
    order().id,
    version,
    database.firestore(),
  );
  assert.equal(view.bank.accountNumber, selected.bank.accountNumber);
  assert.equal(view.bank.qrUrl, first.qrUrl);
  assert.equal(view.manual?.bank?.accountNumber, "1234567890");
  assert.equal(
    [...database.values.keys()].filter((key) =>
      key.startsWith("bankQrVersions/"),
    ).length,
    2,
  );
});

test("proof upload is a draft; explicit submission alone requests review and never marks paid", async () => {
  const database = new MemoryDatabase();
  const version = await proof(database);
  assert.equal(database.current().manualPayment?.status, "unpaid");
  assert.equal(database.current().paid, false);
  const revision = database.current().paymentRevision!;
  await submitManualPayment(order().id, version, database.firestore());
  await submitManualPayment(order().id, version, database.firestore());
  assert.equal(database.current().manualPayment?.status, "awaiting_review");
  assert.equal(manualLocked(database.current().manualPayment), true);
  assert.equal(database.current().paid, false);
  assert.equal(database.current().paymentRevision, revision + 1);
});

test("changing bank clears its current QR while existing payment snapshots retain the original", async () => {
  const database = new MemoryDatabase();
  const first = await setBankQr(
    "cinere",
    new Uint8Array([1]),
    owner,
    database.firestore(),
    upload,
  );
  const selected = await selectManualPayment(order().id, database.firestore());
  const updated = await saveBankDetails(
    "cinere",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  assert.equal(updated.qrUrl, undefined);
  assert.equal(
    (
      database.values.get("settings/cinere")?.manualPayment as {
        qrVersion: string;
      }
    ).qrVersion,
    "",
  );
  assert.equal(selected.bank.qrUrl, first.qrUrl);
});

test("stale account versions cannot upload QR and account changes during upload reject publication", async () => {
  const database = new MemoryDatabase();
  const initial = await saveBankDetails(
    "cinere",
    account,
    owner,
    database.firestore(),
  );
  let uploaded = 0;
  const storage = async () => {
    uploaded++;
  };
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      storage,
      "stale",
    ),
    /Rekening telah berubah/,
  );
  assert.equal(uploaded, 0);
  const racingUpload = async () => {
    uploaded++;
    await saveBankDetails(
      "cinere",
      { ...account, accountNumber: "9876543210" },
      owner,
      database.firestore(),
    );
  };
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      racingUpload,
      initial.version,
    ),
    /berubah saat QR/,
  );
  assert.equal(uploaded, 1);
  assert.equal(
    [...database.values.keys()].filter((key) =>
      key.startsWith("bankQrVersions/"),
    ).length,
    0,
  );
});

test("estimated orders may choose transfer but cannot submit before actual weight and shipping", async () => {
  const database = new MemoryDatabase({
    ...order(),
    actualKg: null,
    shippingFee: null,
  });
  const version = await proof(database);
  await assert.rejects(
    submitManualPayment(order().id, version, database.firestore()),
    /berat aktual/,
  );
  assert.equal(database.current().paid, false);
});

test("admin can confirm an observed bank transfer without a customer receipt", async () => {
  const database = new MemoryDatabase();
  await selectManualPayment(order().id, database.firestore());
  const view = await confirmManualPayment(
    order().id,
    staff,
    database.firestore(),
  );

  assert.equal(database.current().paid, true);
  assert.equal(database.current().manualPayment?.status, "paid");
  assert.equal(database.current().manualPayment?.hasProof, false);
  assert.equal(database.current().manualPayment?.amount, 20000);
  assert.equal(view.paid, true);
  const record = database.values.get(`manualPayments/${order().id}`)!;
  assert.equal(record.reviewedBy, staff.uid);
  assert.equal(record.proofPath, undefined);
});

test("review privileges, proof version, and exact submitted amount are enforced", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "approve",
      "",
      customer,
      database.firestore(),
    ),
    /admin/,
  );
  await assert.rejects(
    reviewManualPayment(
      order().id,
      "stale",
      "approve",
      "",
      staff,
      database.firestore(),
    ),
    /berubah/,
  );
  database.values.set(`orders/${order().id}`, {
    ...database.current(),
    total: 1,
  });
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "approve",
      "",
      staff,
      database.firestore(),
    ),
    /Tagihan berubah/,
  );
  assert.equal(database.current().paid, false);
});

test("approval is idempotent and a later rejection cannot undo settled manual payment", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "reject",
      "wrong",
      owner,
      database.firestore(),
    ),
    /sudah diperiksa/,
  );
  assert.equal(database.current().paid, true);
  assert.equal(database.current().manualPayment?.status, "paid");
});

test("rejected proof requires a note and a genuinely new upload before resubmission", async () => {
  const database = new MemoryDatabase();
  const first = await submitted(database);
  await assert.rejects(
    reviewManualPayment(
      order().id,
      first,
      "reject",
      "",
      staff,
      database.firestore(),
    ),
    /alasan/,
  );
  await reviewManualPayment(
    order().id,
    first,
    "reject",
    "Bukti belum jelas",
    staff,
    database.firestore(),
  );
  await assert.rejects(
    submitManualPayment(order().id, first, database.firestore()),
    /sebelumnya ditolak/,
  );
  const second = (
    await storeManualProof(
      order().id,
      new Uint8Array([2]),
      database.firestore(),
      upload,
    )
  ).manual!.proofVersion!;
  assert.notEqual(second, first);
  assert.equal(database.current().manualPayment?.status, "unpaid");
  await submitManualPayment(order().id, second, database.firestore());
  await reviewManualPayment(
    order().id,
    second,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  assert.equal(database.current().paid, true);
});

test("a stale uploaded receipt cannot be submitted after another tab uploads a new proof", async () => {
  const database = new MemoryDatabase();
  const first = await proof(database);
  const second = (
    await storeManualProof(
      order().id,
      new Uint8Array([2]),
      database.firestore(),
      upload,
    )
  ).manual!.proofVersion!;
  await assert.rejects(
    submitManualPayment(order().id, first, database.firestore()),
    /terbaru/,
  );
  await submitManualPayment(order().id, second, database.firestore());
});

test("upload quota is reserved before storage is called and review blocks proof replacement", async () => {
  const database = new MemoryDatabase();
  await selectManualPayment(order().id, database.firestore());
  let calls = 0;
  const storage = async () => {
    calls++;
  };
  database.values.set(`manualProofLimits/${order().id}`, {
    uploads: Array(12).fill(Date.now()),
  });
  await assert.rejects(
    storeManualProof(
      order().id,
      new Uint8Array([1]),
      database.firestore(),
      storage,
    ),
    /Terlalu banyak/,
  );
  assert.equal(calls, 0);
  database.values.delete(`manualProofLimits/${order().id}`);
  await submitted(database);
  await assert.rejects(
    storeManualProof(
      order().id,
      new Uint8Array([1]),
      database.firestore(),
      storage,
    ),
    /sedang diperiksa/,
  );
  assert.equal(calls, 0);
});

test("manual pending review blocks a second gateway charge and active gateway blocks transfer", async () => {
  const database = new MemoryDatabase();
  await submitted(database);
  const api: Gateway = {
    status: async () => null,
    create: async () => {
      throw Error("must not create");
    },
    expire: async () => {},
  };
  await assert.rejects(
    createPayment(order().id, database.firestore(), api),
    /diperiksa/,
  );
  const active = new MemoryDatabase({
    ...order(),
    payment: {
      provider: "midtrans",
      attemptId: "other",
      amount: 20000,
      status: "pending",
      environment: "sandbox",
      expiresAt: new Date().toISOString(),
    },
  });
  await assert.rejects(
    selectManualPayment(order().id, active.firestore()),
    /QRIS aktif/,
  );
});

test("safe order and tracking summaries never reveal receipt path or reviewer identity", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  const record = database.values.get(`manualPayments/${order().id}`)!;
  const summary = safeManualSummary(
    record as unknown as NonNullable<Order["manualPayment"]>,
  );
  assert.equal("proofPath" in summary, false);
  assert.equal("reviewedBy" in summary, false);
  const tracking = publicTracking({
    ...database.current(),
    manualPayment: record as unknown as NonNullable<Order["manualPayment"]>,
  });
  assert.equal("proofPath" in tracking.manualPayment!, false);
  assert.equal("reviewedBy" in tracking.manualPayment!, false);
});
