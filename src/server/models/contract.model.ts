import { requireDatabase } from "../config/database";
import type { CustomerInput } from "../validators/customer.schema";

const dayMs = 86_400_000;
const dateOnly = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const parseDate = (value: string | Date) => new Date(`${dateOnly(value)}T00:00:00Z`);
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

export function proratedContractAmount(
  start: string | Date,
  stop: string | Date,
  fullPrice: number,
) {
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
      `SELECT c.id,c.plan_start_date,c.agreed_price,c.billing_type,p.name AS plan_name
       FROM customers c LEFT JOIN plans p ON p.id=c.plan_id
       WHERE c.id=$1 AND c.deleted_at IS NULL FOR UPDATE`,
      [customerId],
    );
    if (!result.rowCount)
      throw Object.assign(new Error("Active customer not found"), { status: 404 });
    const customer = result.rows[0];
    const fixedContract = ["one_time", "manual"].includes(customer.billing_type);
    const calculation = fixedContract
      ? {
          periodStart: dateOnly(customer.plan_start_date),
          periodEnd: stopDate,
          usedDays:
            Math.floor(
              (parseDate(stopDate).getTime() - parseDate(customer.plan_start_date).getTime()) /
                dayMs,
            ) + 1,
          totalDays:
            Math.floor(
              (parseDate(stopDate).getTime() - parseDate(customer.plan_start_date).getTime()) /
                dayMs,
            ) + 1,
          amount: Number(customer.agreed_price),
        }
      : proratedContractAmount(customer.plan_start_date, stopDate, Number(customer.agreed_price));
    const existing = await client.query(
      `SELECT i.id,i.invoice_number,i.status,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid
       FROM invoices i WHERE i.customer_id=$1
         AND ($3::BOOLEAN OR i.billing_period=$2::DATE)
       ORDER BY i.billing_period DESC,i.id DESC LIMIT 1`,
      [customerId, calculation.periodStart, fixedContract],
    );
    let invoiceNumber: string;
    if (existing.rowCount) {
      const invoice = existing.rows[0];
      if (!fixedContract && Number(invoice.paid) > calculation.amount)
        throw Object.assign(
          new Error(
            "Received payment exceeds the prorated amount; refund or correct the payment first.",
          ),
          { status: 409 },
        );
      if (!fixedContract)
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
          fixedContract
            ? `${customer.plan_name ?? "Car Wash"} Plan (fixed contract)`
            : `${customer.plan_name ?? "Car Wash"} Plan (prorated final period)`,
          fixedContract
            ? `Contract completed ${stopDate}.`
            : `Contract stopped ${stopDate}. Charged ${calculation.usedDays} of ${calculation.totalDays} days.`,
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
      `UPDATE customer_contracts SET contract_end_date=$1::DATE,status='ended',
        auto_invoice=FALSE,ended_at=COALESCE(ended_at,NOW())
       WHERE customer_id=$2 AND status='active'`,
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

export async function findContractsEndingToday() {
  return (
    await requireDatabase().query(`
      SELECT id,contract_end_date AS "contractEndDate"
      FROM customers
      WHERE deleted_at IS NULL AND status='active'
        AND contract_end_date IS NOT NULL
        AND contract_end_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
        AND NOT EXISTS (
          SELECT 1 FROM contract_stops cs
          WHERE cs.customer_id=customers.id AND cs.stop_date=customers.contract_end_date
        )
      ORDER BY contract_end_date,id
    `)
  ).rows as Array<{ id: string | number; contractEndDate: string | Date }>;
}

export async function findCustomerContracts(customerId: number) {
  return (
    await requireDatabase().query(
      `SELECT cc.id,cc.plan_start_date AS "planStartDate",
        cc.contract_end_date AS "contractEndDate",cc.agreed_price AS "agreedPrice",
        cc.billing_type AS "billingType",cc.washes_per_cycle AS "washesPerCycle",
        cc.auto_invoice AS "autoInvoice",cc.status,cc.created_at AS "createdAt",
        p.name AS "planName"
       FROM customer_contracts cc LEFT JOIN plans p ON p.id=cc.plan_id
       WHERE cc.customer_id=$1
       ORDER BY cc.plan_start_date DESC,cc.id DESC`,
      [customerId],
    )
  ).rows;
}

export async function renewCustomerContract(customerId: number, input: CustomerInput) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT id,plan_id,plan_start_date,contract_end_date,agreed_price,billing_type,
        washes_per_cycle,auto_invoice
       FROM customers WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [customerId],
    );
    if (!current.rowCount) throw Object.assign(new Error("Customer not found"), { status: 404 });
    const old = current.rows[0];
    const oldEnd = old.contract_end_date ? dateOnly(old.contract_end_date) : null;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    if (!oldEnd || oldEnd > today)
      throw Object.assign(new Error("The current contract must end before it can be renewed."), {
        status: 409,
      });
    if (input.planStartDate <= oldEnd)
      throw Object.assign(new Error(`New contract start date must be after ${oldEnd}.`), {
        status: 409,
      });
    if (input.agreedPrice <= 0)
      throw Object.assign(new Error("Enter an agreed price greater than zero."), { status: 400 });
    const finalized = await client.query(
      "SELECT 1 FROM contract_stops WHERE customer_id=$1 AND stop_date=$2::DATE",
      [customerId, oldEnd],
    );
    if (!finalized.rowCount)
      throw Object.assign(
        new Error("The previous contract is still being finalized. Refresh and try again."),
        { status: 409 },
      );

    await client.query(
      `UPDATE customer_contracts SET status='ended',contract_end_date=$2::DATE,
        auto_invoice=FALSE,ended_at=COALESCE(ended_at,NOW())
       WHERE customer_id=$1 AND status='active'`,
      [customerId, oldEnd],
    );
    await client.query(
      `INSERT INTO customer_contracts(customer_id,plan_id,plan_start_date,contract_end_date,
        agreed_price,billing_type,washes_per_cycle,auto_invoice,status,ended_at)
       SELECT $1,$2,$3::DATE,$4::DATE,$5,$6,$7,FALSE,'ended',NOW()
       WHERE NOT EXISTS (SELECT 1 FROM customer_contracts WHERE customer_id=$1)
       ON CONFLICT DO NOTHING`,
      [
        customerId,
        old.plan_id,
        dateOnly(old.plan_start_date),
        oldEnd,
        old.agreed_price,
        old.billing_type,
        old.washes_per_cycle,
      ],
    );
    const automatic = input.autoInvoice && input.billingType !== "manual";
    const nextInvoiceDate = automatic ? input.planStartDate : input.nextInvoiceDate;
    const newContractEnd =
      input.billingType === "one_time" && !input.contractEndDate
        ? input.nextInvoiceDate
        : input.contractEndDate;
    const updated = await client.query(
      `UPDATE customers SET plan_id=$2,plan_start_date=$3::DATE,contract_end_date=$4::DATE,
        agreed_price=$5,billing_type=$6,washes_per_cycle=$7,auto_invoice=$8,
        next_invoice_date=$9::DATE,status='active',updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [
        customerId,
        input.planId,
        input.planStartDate,
        newContractEnd,
        input.agreedPrice,
        input.billingType,
        input.washesPerCycle,
        input.billingType === "manual" ? false : input.autoInvoice,
        input.billingType === "manual" ? null : nextInvoiceDate,
      ],
    );
    await client.query(
      `INSERT INTO customer_contracts(customer_id,plan_id,plan_start_date,contract_end_date,
        agreed_price,billing_type,washes_per_cycle,auto_invoice,status)
       VALUES($1,$2,$3::DATE,$4::DATE,$5,$6,$7,$8,'active')`,
      [
        customerId,
        input.planId,
        input.planStartDate,
        newContractEnd,
        input.agreedPrice,
        input.billingType,
        input.washesPerCycle,
        input.billingType === "manual" ? false : input.autoInvoice,
      ],
    );
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'contract_renewed','Contract renewed',$2)`,
      [
        customerId,
        `New contract starts ${input.planStartDate}${newContractEnd ? ` and ends ${newContractEnd}` : " with no scheduled end"}. Previous contract ending ${oldEnd} remains in history.`,
      ],
    );
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
