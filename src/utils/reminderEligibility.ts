export function canSendPaymentReminder(
  invoice: { balance: number; dueDate: string },
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
) {
  return invoice.balance > 0 && invoice.dueDate.slice(0, 10) <= today;
}

export function isInvoiceDueForDisplay(
  invoice: { dueDate: string },
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
) {
  return invoice.dueDate.slice(0, 10) <= today;
}
