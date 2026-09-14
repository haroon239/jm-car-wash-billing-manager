import { test } from "node:test";
import assert from "node:assert/strict";
import { canSendPaymentReminder } from "./reminderEligibility";
test("unpaid bills due today and overdue allow reminders, future and settled bills do not", () => {
  const today = "2026-09-14";
  assert.equal(canSendPaymentReminder({ balance: 99, dueDate: today }, today), true);
  assert.equal(canSendPaymentReminder({ balance: 30, dueDate: "2026-09-13" }, today), true);
  assert.equal(canSendPaymentReminder({ balance: 99, dueDate: "2026-09-15" }, today), false);
  assert.equal(canSendPaymentReminder({ balance: 0, dueDate: today }, today), false);
});
