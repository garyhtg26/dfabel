import test from "node:test";
import assert from "node:assert/strict";
import { eligibleMemberDiscount } from "../lib/membership-eligibility";
import {
  memberCodeHash,
  memberCodePattern,
  newMemberCode,
  validMemberCode,
  validMemberWallet,
} from "../lib/membership-code";

test("member codes are random-looking, hashed and scoped to branch, expiry and a single use", () => {
  const first = newMemberCode();
  const second = newMemberCode();
  assert.match(first, memberCodePattern);
  assert.notEqual(first, second);
  assert.notEqual(memberCodeHash(first), first);
  const now = 1_000_000;
  const active = { uid: "member", branchId: "cinere", expiresAt: now + 1000 };
  assert.equal(validMemberCode(active, "cinere", now), true);
  assert.equal(validMemberCode(active, "bogor", now), false);
  assert.equal(validMemberCode(active, "cinere", now + 1000), false);
  assert.equal(
    validMemberCode(
      { ...active, usedAt: "2026-11-02T00:00:00Z" },
      "cinere",
      now,
    ),
    false,
  );
  assert.equal(validMemberCode(undefined, "cinere", now), false);
  const wallet = {
    active: true,
    balance: 100000,
    activeCodeHash: memberCodeHash(first),
  };
  assert.equal(validMemberWallet(wallet, memberCodeHash(first)), true);
  assert.equal(validMemberWallet(wallet, memberCodeHash(second)), false);
  assert.equal(
    validMemberWallet(
      { ...wallet, reconciliationRequired: true },
      memberCodeHash(first),
    ),
    false,
  );
  assert.equal(
    validMemberWallet({ ...wallet, active: false }, memberCodeHash(first)),
    false,
  );
  assert.equal(
    validMemberWallet({ ...wallet, balance: 0 }, memberCodeHash(first)),
    false,
  );
});

test("discount eligibility requires an active, available positive balance", () => {
  assert.equal(eligibleMemberDiscount({ active: true, balance: 1 }), true);
  assert.equal(eligibleMemberDiscount({ active: true, balance: 0 }), false);
  assert.equal(eligibleMemberDiscount({ active: true, balance: -1 }), false);
  assert.equal(eligibleMemberDiscount({ active: true, balance: 0.5 }), false);
  assert.equal(
    eligibleMemberDiscount({ active: true, balance: "100000" }),
    false,
  );
  assert.equal(
    eligibleMemberDiscount({ active: false, balance: 100000 }),
    false,
  );
  assert.equal(
    eligibleMemberDiscount({
      active: true,
      balance: 100000,
      reconciliationRequired: true,
    }),
    false,
  );
  assert.equal(eligibleMemberDiscount(undefined), false);
});
