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

type BalanceBill = {
  id: number;
  customerId: number;
  billingPeriodStart: string;
  dueDate: string;
  balance: number;
};

export function previousDueBalance(
  bills: BalanceBill[],
  current: BalanceBill,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
) {
  const currentPeriod = current.billingPeriodStart.slice(0, 10);
  return bills
    .filter((bill) => {
      const billPeriod = bill.billingPeriodStart.slice(0, 10);
      const isEarlier =
        billPeriod < currentPeriod || (billPeriod === currentPeriod && bill.id < current.id);
      return (
        bill.customerId === current.customerId &&
        bill.id !== current.id &&
        bill.balance > 0 &&
        isEarlier &&
        isInvoiceDueForDisplay(bill, today)
      );
    })
    .reduce((sum, bill) => sum + bill.balance, 0);
}
