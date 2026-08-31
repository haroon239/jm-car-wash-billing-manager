export function formatInvoiceStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Payment pending",
    sent: "Invoice sent",
    paid: "Fully paid",
    overdue: "Payment overdue",
    partially_paid: "Partially paid",
    partially_overdue: "Partial payment overdue",
  };
  return labels[status.toLowerCase()] ?? status.replaceAll("_", " ");
}

export function formatBillingType(type: string) {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    weekly: "Weekly",
    one_time: "One-time",
    manual: "Manual",
    cash: "Cash",
    card: "Card",
    bank_transfer: "Bank transfer",
    other: "Other",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export function formatDubaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(date);
}

export function getDubaiGreeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Dubai",
    }).format(date),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getDubaiIsoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dubai",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
