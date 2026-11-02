import assert from "node:assert/strict";
import test from "node:test";
import { paidOrderSalesValue } from "../lib/sales";
import type { Order } from "../lib/types";

const order = (values: Partial<Order> = {}) =>
  ({
    paid: true,
    total: 17_000,
    ...values,
  }) as Order;

test("nilai penjualan memasukkan saldo membership yang dipakai tanpa menghitung deposit", () => {
  assert.equal(
    paidOrderSalesValue(order({ total: 0, membershipUsed: 20_000 })),
    20_000,
  );
  assert.equal(
    paidOrderSalesValue(order({ total: 5_000, membershipUsed: 15_000 })),
    20_000,
  );
  assert.equal(paidOrderSalesValue(order()), 17_000);
});

test("nilai penjualan tidak memasukkan pesanan belum lunas dan yang perlu pemeriksaan", () => {
  assert.equal(
    paidOrderSalesValue(order({ paid: false, membershipUsed: 5_000 })),
    0,
  );
  assert.equal(
    paidOrderSalesValue(order({ paymentReconciliationRequired: true })),
    0,
  );
});

test("nilai penjualan tidak memasukkan pembayaran sandbox", () => {
  const sandbox = { environment: "sandbox" } as NonNullable<Order["payment"]>;
  assert.equal(
    paidOrderSalesValue(order({ payment: sandbox, membershipUsed: 10_000 })),
    0,
  );
});
