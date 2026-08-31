import { requireDatabase } from "../config/database";
import type { PaymentInput } from "../validators/payment.schema";

export async function findPayments() {
  return (
    await requireDatabase().query(
      `SELECT pay.id,pay.invoice_id AS "invoiceId",pay.amount,pay.method,pay.reference,
        pay.note,pay.paid_at AS "paidAt",pay.recorded_by AS "recordedBy",
        i.invoice_number AS "invoiceNumber",c.name AS "customerName"
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
    const invoice = await client.query(
      `SELECT i.id,i.total,i.status,i.customer_id,i.invoice_number,i.due_date,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount,
        i.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE AS is_past_due
       FROM invoices i
       WHERE i.id=$1
       FOR UPDATE`,
      [input.invoiceId],
    );
    if (!invoice.rowCount) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    if (invoice.rows[0].status === "paid")
      throw Object.assign(new Error("Invoice is already paid"), { status: 409 });
    const paidAmount = Number(invoice.rows[0].paid_amount);
    const total = Number(invoice.rows[0].total);
    const remainingBefore = Math.max(total - paidAmount, 0);
    if (input.amount > remainingBefore + 0.001)
      throw Object.assign(
        new Error(`Payment cannot exceed the remaining AED ${remainingBefore.toFixed(2)}`),
        { status: 409 },
      );
    const totalPaid = paidAmount + input.amount;
    const balance = Math.max(total - totalPaid, 0);
    const nextStatus =
      balance <= 0.001
        ? "paid"
        : invoice.rows[0].is_past_due
          ? "partially_overdue"
          : "partially_paid";
    const result = await client.query(
      `INSERT INTO payments (invoice_id,amount,method,reference,note)
       VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''))
       RETURNING id,invoice_id AS "invoiceId",amount,method,reference,note,
         paid_at AS "paidAt",recorded_by AS "recordedBy"`,
      [input.invoiceId, input.amount, input.method, input.reference, input.note],
    );
    const automaticCustomerNote =
      balance > 0.001
        ? `Payment of AED ${input.amount.toFixed(2)} received. Remaining balance AED ${balance.toFixed(2)}.`
        : "";
    const updatedInvoice = await client.query(
      `UPDATE invoices
       SET status=$1,
         customer_note=CASE
           WHEN $3 <> '' AND customer_note='' THEN $3
           ELSE customer_note
         END
       WHERE id=$2
       RETURNING customer_note AS "customerNote"`,
      [nextStatus, input.invoiceId, automaticCustomerNote],
    );
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'payment_received','Payment received',$2)`,
      [
        invoice.rows[0].customer_id,
        `AED ${input.amount.toFixed(2)} received for ${invoice.rows[0].invoice_number} via ${input.method.replace("_", " ")}. Remaining balance AED ${balance.toFixed(2)}.`,
      ],
    );
    await client.query("COMMIT");
    return {
      ...result.rows[0],
      invoiceStatus: nextStatus,
      paidAmount: totalPaid,
      balance,
      customerNote: updatedInvoice.rows[0].customerNote,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
