import assert from "node:assert/strict";
import test from "node:test";
import { paymentSchema } from "./payment.schema";

test("new payments accept only Cash and Online", () => {
  const payment = { invoiceId: 1, amount: 100 };
  for (const method of ["cash", "online"]) {
    assert.equal(paymentSchema.safeParse({ ...payment, method }).success, true);
  }
  for (const method of ["card", "bank_transfer", "other"]) {
    assert.equal(paymentSchema.safeParse({ ...payment, method }).success, false);
  }
});
