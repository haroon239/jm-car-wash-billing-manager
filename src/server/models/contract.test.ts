import assert from "node:assert/strict";
import test from "node:test";
import { proratedContractAmount } from "./contract.model";

test("prorates a September contract stopped on day 20", () => {
  const result = proratedContractAmount("2026-09-01", "2026-09-20", 150);
  assert.deepEqual(result, {
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    usedDays: 20,
    totalDays: 30,
    amount: 100,
  });
});

test("uses the customer's anniversary for mid-month contracts", () => {
  const result = proratedContractAmount("2026-06-18", "2026-09-20", 150);
  assert.equal(result.periodStart, "2026-09-18");
  assert.equal(result.periodEnd, "2026-10-17");
  assert.equal(result.amount, 15);
});
