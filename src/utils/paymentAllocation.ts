export type UnpaidBill = { id: number; balance: number };

// Allocate in the caller's oldest-first order, using cents to avoid rounding drift.
export function allocatePayment(amount: number, bills: UnpaidBill[]) {
  let remaining = Math.round(amount * 100);
  const allocations: { invoiceId: number; amount: number }[] = [];
  for (const bill of bills) {
    const applied = Math.min(remaining, Math.max(0, Math.round(bill.balance * 100)));
    if (applied > 0) allocations.push({ invoiceId: bill.id, amount: applied / 100 });
    remaining -= applied;
  }
  if (remaining > 0) throw new Error("Payment exceeds the outstanding balance.");
  return allocations;
}
