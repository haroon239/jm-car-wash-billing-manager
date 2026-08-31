import assert from "node:assert/strict";
import test from "node:test";
import { calculateNextBillingDate } from "./billing";
import { formatBillingType, formatInvoiceStatus, getDubaiIsoDate } from "./display";

test("monthly billing keeps the preferred day", () => {
  assert.equal(calculateNextBillingDate("2026-07-19", "monthly"), "2026-08-19");
});

test("monthly billing handles shorter months", () => {
  assert.equal(calculateNextBillingDate("2026-01-31", "monthly"), "2026-02-28");
});

test("weekly and manual billing dates are predictable", () => {
  assert.equal(calculateNextBillingDate("2026-08-11", "weekly"), "2026-08-18");
  assert.equal(calculateNextBillingDate("2026-08-11", "manual"), "");
});

test("technical values become owner-friendly labels", () => {
  assert.equal(formatInvoiceStatus("partially_overdue"), "Partial payment overdue");
  assert.equal(formatBillingType("bank_transfer"), "Bank transfer");
});

test("report dates use the Dubai calendar day", () => {
  assert.equal(getDubaiIsoDate(new Date("2026-08-10T21:30:00Z")), "2026-08-11");
});
