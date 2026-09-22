import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canSendPaymentReminder,
  isInvoiceDueForDisplay,
  previousDueBalance,
} from "./reminderEligibility";
test("unpaid bills due today and overdue allow reminders, future and settled bills do not", () => {
  const today = "2026-09-14";
  assert.equal(canSendPaymentReminder({ balance: 99, dueDate: today }, today), true);
  assert.equal(canSendPaymentReminder({ balance: 30, dueDate: "2026-09-13" }, today), true);
  assert.equal(canSendPaymentReminder({ balance: 99, dueDate: "2026-09-15" }, today), false);
  assert.equal(canSendPaymentReminder({ balance: 0, dueDate: today }, today), false);
  assert.equal(
    canSendPaymentReminder(
      { balance: 99, dueDate: today, paidAmount: 0, status: "overdue" },
      today,
    ),
    true,
  );
  assert.equal(
    canSendPaymentReminder(
      { balance: 49, dueDate: today, paidAmount: 50, status: "partially_paid" },
      today,
    ),
    false,
  );
  assert.equal(
    canSendPaymentReminder(
      { balance: 49, dueDate: today, paidAmount: 50, status: "partially_overdue" },
      today,
    ),
    false,
  );
  assert.equal(
    canSendPaymentReminder({ balance: 0, dueDate: today, paidAmount: 99, status: "paid" }, today),
    false,
  );
});
test("future bills stay hidden until their due date", () => {
  assert.equal(isInvoiceDueForDisplay({ dueDate: "2026-10-14" }, "2026-09-16"), false);
  assert.equal(isInvoiceDueForDisplay({ dueDate: "2026-10-14" }, "2026-10-14"), true);
});

test("previous balance excludes paid and future hidden bills", () => {
  const current = {
    id: 17,
    customerId: 1,
    billingPeriodStart: "2026-10-14",
    dueDate: "2026-09-16",
    balance: 270,
  };
  const bills = [
    current,
    {
      id: 16,
      customerId: 1,
      billingPeriodStart: "2026-09-14",
      dueDate: "2026-10-14",
      balance: 99,
    },
    {
      id: 15,
      customerId: 1,
      billingPeriodStart: "2026-08-14",
      dueDate: "2026-09-14",
      balance: 0,
    },
  ];
  assert.equal(previousDueBalance(bills, current, "2026-09-16"), 0);
  assert.equal(previousDueBalance(bills, current, "2026-10-14"), 99);
});
