import { requireDatabase } from "../config/database";
import type { PaymentInput } from "../validators/payment.schema";
import { randomUUID } from "node:crypto";
import { allocatePayment } from "../../utils/paymentAllocation";

export async function findPayments() {
  return (
    await requireDatabase().query(
      `SELECT pay.id,pay.invoice_id AS "invoiceId",pay.amount,pay.method,pay.reference,
        pay.note,pay.paid_at AS "paidAt",pay.recorded_by AS "recordedBy",
        i.invoice_number AS "invoiceNumber",c.name AS "customerName",pay.payment_group AS "paymentGroup"
       FROM payments pay
       JOIN invoices i ON i.id=pay.invoice_id
       JOIN customers c ON c.id=i.customer_id
       ORDER BY pay.paid_at DESC,pay.id DESC`,
    )
  ).rows;
}

export async function createPayment(input: PaymentInput) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const target = await client.query("SELECT customer_id FROM invoices WHERE id=$1", [
      input.invoiceId,
    ]);
    if (!target.rowCount) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    // Serialize payments for this customer, including allocations across multiple bills.
    await client.query("SELECT id FROM customers WHERE id=$1 FOR UPDATE", [
      target.rows[0].customer_id,
    ]);
    const bills = await client.query(
      `SELECT i.id,i.invoice_number,i.total,i.billing_period,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount,
        i.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE AS is_past_due
       FROM invoices i
       WHERE i.customer_id=$1 AND (i.billing_period,i.id) <=
         (SELECT billing_period,id FROM invoices WHERE id=$2)
       ORDER BY i.billing_period,i.id FOR UPDATE`,
      [target.rows[0].customer_id, input.invoiceId],
    );
    const outstandingBills = bills.rows
      .map((bill) => ({
        ...bill,
        balance: Math.max(0, Number(bill.total) - Number(bill.paid_amount)),
      }))
      .filter((bill) => bill.balance > 0);
    const outstanding = outstandingBills.reduce((sum, bill) => sum + bill.balance, 0);
    if (input.amount > outstanding + 0.001)
      throw Object.assign(
        new Error(`Payment cannot exceed the remaining AED ${outstanding.toFixed(2)}`),
        { status: 409 },
      );
    const allocationPlan = allocatePayment(
      input.amount,
      outstandingBills.map((bill) => ({ id: Number(bill.id), balance: bill.balance })),
    );
    const group = randomUUID();
    const allocations = [];
    const paymentRows = [];
    for (const allocation of allocationPlan) {
      const bill = outstandingBills.find((item) => Number(item.id) === allocation.invoiceId)!;
      const paidAmount = Number(bill.paid_amount) + allocation.amount;
      const balance = Math.max(0, Math.round((Number(bill.total) - paidAmount) * 100) / 100);
      const status =
        balance === 0 ? "paid" : bill.is_past_due ? "partially_overdue" : "partially_paid";
      const saved = await client.query(
        `INSERT INTO payments(invoice_id,amount,method,reference,note,payment_group)
         VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6)
         RETURNING id,invoice_id AS "invoiceId",amount,method,reference,note,paid_at AS "paidAt",recorded_by AS "recordedBy",payment_group AS "paymentGroup"`,
        [allocation.invoiceId, allocation.amount, input.method, input.reference, input.note, group],
      );
      const updatedInvoice = await client.query(
        `UPDATE invoices SET status=$1,
          customer_note=CASE WHEN customer_note ~ '^Payment of AED [0-9.]+ received\\. Remaining balance AED [0-9.]+\\.$' THEN '' ELSE customer_note END
         WHERE id=$2 RETURNING customer_note AS "customerNote"`,
        [status, allocation.invoiceId],
      );
      allocations.push({
        ...allocation,
        invoiceNumber: bill.invoice_number,
        billingPeriodStart: bill.billing_period,
        status,
        paidAmount,
        balance,
        customerNote: updatedInvoice.rows[0].customerNote,
      });
      paymentRows.push({ ...saved.rows[0], invoiceNumber: bill.invoice_number });
    }
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details) VALUES($1,'payment_received','Payment received',$2)`,
      [
        target.rows[0].customer_id,
        `AED ${input.amount.toFixed(2)} received via ${input.method}. Oldest unpaid bills cleared first. ${allocations.map((item) => `${item.invoiceNumber}: AED ${item.amount.toFixed(2)}`).join("; ")}`,
      ],
    );
    await client.query("COMMIT");
    return {
      paymentGroup: group,
      amount: input.amount,
      payments: paymentRows,
      allocations,
      balance: Math.max(0, Math.round((outstanding - input.amount) * 100) / 100),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
