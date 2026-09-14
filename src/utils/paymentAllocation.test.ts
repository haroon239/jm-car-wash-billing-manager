import assert from "node:assert/strict";
import test from "node:test";
import { allocatePayment } from "./paymentAllocation";

test("one payment clears the previous 30 and current 99", () => {
  assert.deepEqual(
    allocatePayment(129, [
      { id: 1, balance: 30 },
      { id: 2, balance: 99 },
    ]),
    [
      { invoiceId: 1, amount: 30 },
      { invoiceId: 2, amount: 99 },
    ],
  );
});
test("partial payment clears oldest balance first", () => {
  assert.deepEqual(
    allocatePayment(100, [
      { id: 1, balance: 30 },
      { id: 2, balance: 99 },
    ]),
    [
      { invoiceId: 1, amount: 30 },
      { invoiceId: 2, amount: 70 },
    ],
  );
  assert.throws(() => allocatePayment(130, [{ id: 1, balance: 129 }]));
});
