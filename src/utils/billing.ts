import type { Customer } from "../types/domain";

export function calculateNextBillingDate(startDate: string, billingType: Customer["billingType"]) {
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
