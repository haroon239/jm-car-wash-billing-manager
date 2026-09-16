import type { Customer } from "../types/domain";

function dateOnly(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function calculateNextBillingDate(
  startDate: string | Date,
  billingType: Customer["billingType"],
) {
  startDate = dateOnly(startDate);
  if (!startDate || billingType === "manual") return "";
  const [year, month, day] = startDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (billingType === "monthly") {
    const nextMonth = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();
    nextMonth.setUTCDate(Math.min(day, lastDay));
    return nextMonth.toISOString().slice(0, 10);
  }
  if (billingType === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

/** Payment becomes due when the billed service cycle finishes. */
export function calculatePaymentDueDate(
  billingPeriodStart: string | Date,
  billingType: Customer["billingType"],
  anniversaryStart: string | Date = billingPeriodStart,
) {
  billingPeriodStart = dateOnly(billingPeriodStart);
  anniversaryStart = dateOnly(anniversaryStart);
  if (!billingPeriodStart) return "";
  if (billingType === "monthly") {
    const [year, month] = billingPeriodStart.split("-").map(Number);
    const preferredDay = Number(anniversaryStart.split("-")[2]);
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(preferredDay, lastDay)))
      .toISOString()
      .slice(0, 10);
  }
  if (billingType === "weekly") return calculateNextBillingDate(billingPeriodStart, billingType);
  // One-time/manual bills are payable on their selected billing date.
  return billingPeriodStart;
}
