import { requireDatabase } from "../config/database";

const dayMs = 86_400_000;
const parseDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);
function addMonth(value: Date) {
  const day = value.getUTCDate();
  const result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function proratedContractAmount(start: string, stop: string, fullPrice: number) {
  const anchor = parseDate(start);
  const stopped = parseDate(stop);
  if (stopped < anchor)
    throw Object.assign(new Error("Stop date cannot be before contract start"), { status: 400 });
  let periodStart = anchor;
  let next = addMonth(periodStart);
  while (next <= stopped) {
    periodStart = next;
    next = addMonth(periodStart);
  }
  const periodEnd = new Date(next.getTime() - dayMs);
  const usedDays = Math.floor((stopped.getTime() - periodStart.getTime()) / dayMs) + 1;
  const totalDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / dayMs) + 1;
  return {
    periodStart: iso(periodStart),
    periodEnd: iso(periodEnd),
    usedDays,
    totalDays,
    amount: Math.round((fullPrice * usedDays * 100) / totalDays) / 100,
  };
}

export async function stopCustomerContract(customerId: number, stopDate: string, reason: string) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT c.id,c.plan_start_date,c.agreed_price,p.name AS plan_name
       FROM customers c LEFT JOIN plans p ON p.id=c.plan_id
       WHERE c.id=$1 AND c.deleted_at IS NULL FOR UPDATE`,
      [customerId],
    );
    if (!result.rowCount)
      throw Object.assign(new Error("Active customer not found"), { status: 404 });
    const customer = result.rows[0];
    const calculation = proratedContractAmount(
      String(customer.plan_start_date),
      stopDate,
      Number(customer.agreed_price),
    );
    const existing = await client.query(
      `SELECT i.id,i.invoice_number,i.status,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid
       FROM invoices i WHERE i.customer_id=$1 AND i.billing_period=$2::DATE`,
      [customerId, calculation.periodStart],
    );
    let invoiceNumber: string;
    if (existing.rowCount) {
      const invoice = existing.rows[0];
      if (Number(invoice.paid) > calculation.amount)
        throw Object.assign(
          new Error(
            "Received payment exceeds the prorated amount; refund or correct the payment first.",
          ),
          { status: 409 },
        );
      await client.query(
        `UPDATE invoices SET subtotal=$1,total=$1,due_date=$2::DATE,
          description=$3,customer_note=$4,
          status=CASE WHEN $5::NUMERIC=$1 THEN 'paid' WHEN $5::NUMERIC>0 THEN 'partially_paid' ELSE 'pending' END
         WHERE id=$6`,
        [
          calculation.amount,
          stopDate,
          `${customer.plan_name ?? "Car Wash"} Plan (prorated final period)`,
          `Contract stopped ${stopDate}. Charged ${calculation.usedDays} of ${calculation.totalDays} days.`,
          Number(invoice.paid),
          invoice.id,
        ],
      );
      invoiceNumber = invoice.invoice_number;
    } else {
      const settings = await client.query("SELECT invoice_prefix FROM company_settings WHERE id=1");
      const prefix = String(settings.rows[0]?.invoice_prefix ?? "JMCW");
      const inserted = await client.query(
        `INSERT INTO invoices(invoice_number,customer_id,subtotal,vat_amount,total,status,
          issue_date,due_date,billing_month,billing_period,generation_source,description,customer_note)
         VALUES($1,$2,$3,0,$3,'pending',$4,$4::DATE,DATE_TRUNC('month',$5::DATE)::DATE,$5,'manual',$6,$7)
         RETURNING id`,
        [
          `TMP-STOP-${Date.now()}-${customerId}`,
          customerId,
          calculation.amount,
          stopDate,
          calculation.periodStart,
          `${customer.plan_name ?? "Car Wash"} Plan (prorated final period)`,
          `Contract stopped ${stopDate}. Charged ${calculation.usedDays} of ${calculation.totalDays} days.`,
        ],
      );
      invoiceNumber = `${prefix}-${parseDate(stopDate).getUTCFullYear()}-${String(inserted.rows[0].id).padStart(6, "0")}`;
      await client.query("UPDATE invoices SET invoice_number=$1 WHERE id=$2", [
        invoiceNumber,
        inserted.rows[0].id,
      ]);
    }
    await client.query(
      `UPDATE customers SET contract_end_date=$1,auto_invoice=FALSE,next_invoice_date=NULL,updated_at=NOW() WHERE id=$2`,
      [stopDate, customerId],
    );
    await client.query(
      `INSERT INTO contract_stops(customer_id,stop_date,period_start,period_end,full_price,prorated_amount,reason)
       VALUES($1,$2,$3,$4,$5,$6,NULLIF($7,'')) ON CONFLICT(customer_id,stop_date) DO NOTHING`,
      [
        customerId,
        stopDate,
        calculation.periodStart,
        calculation.periodEnd,
        customer.agreed_price,
        calculation.amount,
        reason,
      ],
    );
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'contract_stopped','Contract stopped',$2)`,
      [
        customerId,
        `${invoiceNumber}: ${calculation.usedDays}/${calculation.totalDays} days, AED ${calculation.amount.toFixed(2)}.${reason ? ` ${reason}` : ""}`,
      ],
    );
    await client.query("COMMIT");
    return { invoiceNumber, ...calculation };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
