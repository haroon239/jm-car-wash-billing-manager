import { requireDatabase } from "../config/database";
import { calculatePaymentDueDate } from "../../utils/billing";
import { logCustomerActivity } from "./activity.model";

const uaeToday = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE";

const invoiceFields = `i.id,i.invoice_number AS "invoiceNumber",
  i.customer_id AS "customerId",i.subtotal,i.vat_amount AS "vatAmount",i.total,
  i.status,i.issue_date AS "issueDate",i.due_date AS "dueDate",i.sent_at AS "sentAt",
  i.billing_period AS "billingPeriodStart",i.reminder_sent_at AS "reminderSentAt",
  i.description,i.customer_note AS "customerNote",
  COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id=i.id),0) AS "paidAmount",
  GREATEST(i.total-COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id=i.id),0),0) AS balance,
  i.revision_number AS "revisionNumber"`;

export async function findInvoices() {
  return (
    await requireDatabase().query(`
      SELECT ${invoiceFields},c.name AS "customerName",c.phone,
        c.plate_number AS "plateNumber",c.billing_type AS "billingType",
        p.name AS "planName"
      FROM invoices i
      JOIN customers c ON c.id=i.customer_id
      LEFT JOIN plans p ON p.id=c.plan_id
      ORDER BY i.issue_date DESC,i.id DESC
    `)
  ).rows;
}

export type InvoicePageOptions = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  unpaidOnly?: boolean;
  areaId?: number;
  buildingId?: number;
};

export async function findInvoicePage(options: InvoicePageOptions) {
  const conditions: string[] = ["c.deleted_at IS NULL"];
  const values: Array<string | number> = [];
  const addValue = (value: string | number) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (options.search) {
    const parameter = addValue(`%${options.search}%`);
    conditions.push(
      `(i.invoice_number ILIKE ${parameter} OR c.name ILIKE ${parameter} OR c.plate_number ILIKE ${parameter})`,
    );
  }
  if (options.status === "reminder_sent") conditions.push("i.reminder_sent_at IS NOT NULL");
  else if (options.status === "reminder_unsent") conditions.push("i.reminder_sent_at IS NULL");
  else if (options.status === "pending") conditions.push("i.status IN ('pending','sent')");
  else if (options.status === "overdue")
    conditions.push("i.status IN ('overdue','partially_overdue')");
  else if (options.status) conditions.push(`i.status=${addValue(options.status)}`);
  if (options.unpaidOnly)
    conditions.push(
      `i.total > COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id=i.id),0)`,
    );
  if (options.unpaidOnly) conditions.push(`i.due_date <= ${uaeToday}`);
  if (options.areaId) conditions.push(`c.area_id=${addValue(options.areaId)}`);
  if (options.buildingId) conditions.push(`c.building_id=${addValue(options.buildingId)}`);

  const where = `WHERE ${conditions.join(" AND ")}`;
  const database = requireDatabase();
  const total = Number(
    (
      await database.query(
        `SELECT COUNT(*) AS total FROM invoices i JOIN customers c ON c.id=i.customer_id ${where}`,
        values,
      )
    ).rows[0].total,
  );
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const limitParameter = addValue(options.pageSize);
  const offsetParameter = addValue((page - 1) * options.pageSize);
  const items = (
    await database.query(
      `SELECT ${invoiceFields},c.name AS "customerName",c.phone,
        c.plate_number AS "plateNumber",c.billing_type AS "billingType",
        p.name AS "planName"
       FROM invoices i
       JOIN customers c ON c.id=i.customer_id
       LEFT JOIN plans p ON p.id=c.plan_id
       ${where}
       ORDER BY i.issue_date DESC,i.id DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )
  ).rows;

  return { items, total, page, pageSize: options.pageSize, totalPages };
}

type InvoiceGenerationOptions = {
  issueDate?: string;
  billingPeriod?: string;
  source?: "manual" | "automatic";
};

export async function findCustomerBillingSchedule(customerId: number) {
  return (
    await requireDatabase().query(
      `SELECT next_invoice_date AS "invoiceDate",billing_type AS "billingType",
        contract_end_date AS "contractEndDate"
       FROM customers
       WHERE id=$1 AND deleted_at IS NULL`,
      [customerId],
    )
  ).rows[0] as
    | {
        invoiceDate: string | null;
        billingType: "monthly" | "weekly" | "one_time" | "manual";
        contractEndDate: string | Date | null;
      }
    | undefined;
}

export async function createInvoice(customerId: number, options: InvoiceGenerationOptions = {}) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const customer = await client.query(
      `SELECT c.id,c.name,c.phone,c.plate_number,c.agreed_price,c.billing_type,c.plan_start_date,
        p.name AS plan_name
       FROM customers c
       JOIN plans p ON p.id=c.plan_id
       WHERE c.id=$1 AND c.deleted_at IS NULL`,
      [customerId],
    );
    if (!customer.rowCount)
      throw Object.assign(new Error("Active customer not found"), { status: 404 });

    const billingPeriod = options.billingPeriod ?? options.issueDate ?? null;
    const effectivePeriod =
      billingPeriod ??
      options.issueDate ??
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    const dueDate = calculatePaymentDueDate(
      effectivePeriod,
      customer.rows[0].billing_type,
      customer.rows[0].plan_start_date,
    );
    const existing = await client.query(
      `SELECT ${invoiceFields}
       FROM invoices i
       WHERE i.customer_id=$1
         AND i.billing_period=COALESCE($2::DATE,${uaeToday})`,
      [customerId, billingPeriod],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return invoiceWithCustomer(existing.rows[0], customer.rows[0], true);
    }

    const settings = await client.query("SELECT invoice_prefix FROM company_settings WHERE id=1");
    const prefix = String(settings.rows[0]?.invoice_prefix ?? "JMCW");
    const total = Number(customer.rows[0].agreed_price);
    const description = `${customer.rows[0].plan_name} Car Wash Plan`;
    const inserted = await client.query(
      `INSERT INTO invoices (
        invoice_number,customer_id,subtotal,vat_amount,total,issue_date,due_date,
        billing_month,billing_period,generation_source,description
      ) VALUES (
        $1,$2,$3,0,$3,
        COALESCE($4::DATE,${uaeToday}),
        $8::DATE,
        DATE_TRUNC('month',COALESCE($5::DATE,$4::DATE,${uaeToday}))::DATE,
        COALESCE($5::DATE,$4::DATE,${uaeToday}),$6,$7
      )
      ON CONFLICT (customer_id,billing_period) DO NOTHING
      RETURNING id,issue_date`,
      [
        `TMP-${Date.now()}-${customerId}`,
        customerId,
        total,
        options.issueDate ?? null,
        billingPeriod,
        options.source ?? "manual",
        description,
        dueDate,
      ],
    );
    if (!inserted.rowCount) {
      const concurrent = await client.query(
        `SELECT ${invoiceFields} FROM invoices i
         WHERE i.customer_id=$1
           AND i.billing_period=COALESCE($2::DATE,${uaeToday})`,
        [customerId, billingPeriod],
      );
      await client.query("COMMIT");
      return invoiceWithCustomer(concurrent.rows[0], customer.rows[0], true);
    }

    const id = Number(inserted.rows[0].id);
    const invoiceYear = new Date(inserted.rows[0].issue_date).getUTCFullYear();
    const invoiceNumber = `${prefix}-${invoiceYear}-${String(id).padStart(6, "0")}`;
    const result = await client.query(
      `UPDATE invoices SET invoice_number=$1 WHERE id=$2
       RETURNING id,invoice_number AS "invoiceNumber",customer_id AS "customerId",
         subtotal,vat_amount AS "vatAmount",total,status,issue_date AS "issueDate",
         due_date AS "dueDate",sent_at AS "sentAt",
         billing_period AS "billingPeriodStart",description,customer_note AS "customerNote",
         0::NUMERIC AS "paidAmount",total AS balance,
         revision_number AS "revisionNumber"`,
      [invoiceNumber, id],
    );
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'invoice_generated','Invoice generated',$2)`,
      [customerId, `${invoiceNumber} generated for AED ${total.toFixed(2)}.`],
    );
    await client.query("COMMIT");
    return invoiceWithCustomer(result.rows[0], customer.rows[0], false);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function invoiceWithCustomer(
  invoice: Record<string, unknown>,
  customer: Record<string, unknown>,
  wasExisting: boolean,
) {
  return {
    ...invoice,
    customerName: customer.name,
    phone: customer.phone,
    plateNumber: customer.plate_number,
    planName: customer.plan_name,
    billingType: customer.billing_type,
    wasExisting,
  };
}

export async function findCustomersDueForInvoice() {
  return (
    await requireDatabase().query(`
      SELECT c.id,c.next_invoice_date AS "invoiceDate",c.billing_type AS "billingType"
      FROM customers c
      JOIN plans p ON p.id=c.plan_id AND p.is_active=TRUE
      WHERE c.deleted_at IS NULL
        AND c.status='active'
        AND c.auto_invoice=TRUE
        AND c.billing_type IN ('monthly','weekly','one_time')
        AND c.next_invoice_date IS NOT NULL
        AND c.next_invoice_date <= ${uaeToday}
        AND (c.contract_end_date IS NULL OR c.next_invoice_date <= c.contract_end_date)
      ORDER BY c.next_invoice_date,c.id
    `)
  ).rows as Array<{
    id: string | number;
    invoiceDate: string;
    billingType: "monthly" | "weekly" | "one_time";
  }>;
}

export async function advanceCustomerBilling(
  customerId: number,
  billingType: "monthly" | "weekly" | "one_time",
) {
  const expression =
    billingType === "monthly"
      ? `MAKE_DATE(
          EXTRACT(YEAR FROM next_invoice_date + INTERVAL '1 month')::INTEGER,
          EXTRACT(MONTH FROM next_invoice_date + INTERVAL '1 month')::INTEGER,
          LEAST(
            EXTRACT(DAY FROM plan_start_date)::INTEGER,
            EXTRACT(
              DAY FROM (
                DATE_TRUNC('month',next_invoice_date) + INTERVAL '2 month - 1 day'
              )
            )::INTEGER
          )
        )`
      : billingType === "weekly"
        ? "next_invoice_date + INTERVAL '7 days'"
        : "NULL";
  await requireDatabase().query(
    `UPDATE customers
     SET next_invoice_date=${expression},
       auto_invoice=CASE WHEN $2::VARCHAR='one_time' THEN FALSE ELSE auto_invoice END,
       updated_at=NOW()
     WHERE id=$1`,
    [customerId, billingType],
  );
}

export async function markPastDueInvoicesOverdue() {
  return (
    await requireDatabase().query(`
      UPDATE invoices
      SET status=CASE
        WHEN status='partially_paid' THEN 'partially_overdue'
        ELSE 'overdue'
      END
      WHERE status IN ('pending','sent','partially_paid') AND due_date < ${uaeToday}
      RETURNING id
    `)
  ).rowCount;
}

export async function updateInvoiceStatus(id: number, status: string) {
  const result = (
    await requireDatabase().query(
      `UPDATE invoices
       SET status=CASE
         WHEN COALESCE(
           (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=invoices.id),
           0
         ) > 0
           THEN CASE
             WHEN due_date < ${uaeToday} THEN 'partially_overdue'
             ELSE 'partially_paid'
           END
         ELSE $1::VARCHAR
       END,
         sent_at=CASE
           WHEN $1::VARCHAR='sent' THEN NOW()
           WHEN $1::VARCHAR='pending' THEN NULL
           ELSE sent_at
         END
       WHERE id=$2
       RETURNING id,status,sent_at AS "sentAt",customer_id AS "customerId",
         invoice_number AS "invoiceNumber"`,
      [status, id],
    )
  ).rows[0];
  if (result && ["sent", "pending"].includes(status)) {
    await logCustomerActivity(
      Number(result.customerId),
      status === "sent" ? "invoice_sent" : "invoice_unsent",
      status === "sent" ? "Bill marked sent" : "Bill marked unsent",
      result.invoiceNumber,
    );
  }
  return result;
}

export type InvoiceEditInput = {
  description: string;
  customerNote: string;
  total: number;
  issueDate: string;
  dueDate: string;
  reason: string;
  applyToFuture: boolean;
};

export async function editInvoice(id: number, input: InvoiceEditInput) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT i.*,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount
       FROM invoices i WHERE i.id=$1 FOR UPDATE`,
      [id],
    );
    if (!current.rowCount) throw Object.assign(new Error("Bill not found"), { status: 404 });
    if (current.rows[0].status === "paid")
      throw Object.assign(new Error("Paid bills cannot be edited"), { status: 409 });
    if (input.total < Number(current.rows[0].paid_amount))
      throw Object.assign(
        new Error(
          `Invoice total cannot be less than the received AED ${Number(current.rows[0].paid_amount).toFixed(2)}`,
        ),
        { status: 409 },
      );

    const revisionNumber = Number(current.rows[0].revision_number) + 1;
    await client.query(
      `INSERT INTO invoice_revisions (
        invoice_id,revision_number,old_description,new_description,old_total,new_total,
        old_issue_date,new_issue_date,old_due_date,new_due_date,reason,
        old_customer_note,new_customer_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        revisionNumber,
        current.rows[0].description,
        input.description,
        current.rows[0].total,
        input.total,
        current.rows[0].issue_date,
        input.issueDate,
        current.rows[0].due_date,
        input.dueDate,
        input.reason,
        current.rows[0].customer_note ?? "",
        input.customerNote,
      ],
    );
    const updated = await client.query(
      `UPDATE invoices
       SET description=$1,subtotal=$2,total=$2,vat_amount=0,vat_rate=0,
         issue_date=$3,due_date=$4,customer_note=$5,revision_number=$6,
         status=CASE
           WHEN $2 <= $8 THEN 'paid'
           WHEN $8 > 0 AND $4::DATE < ${uaeToday} THEN 'partially_overdue'
           WHEN $8 > 0 THEN 'partially_paid'
           WHEN $4::DATE < ${uaeToday} THEN 'overdue'
           ELSE 'pending'
         END,
         sent_at=NULL
       WHERE id=$7
       RETURNING id,description,total,subtotal,status,issue_date AS "issueDate",
         due_date AS "dueDate",customer_note AS "customerNote",
         revision_number AS "revisionNumber",sent_at AS "sentAt",
         $8::NUMERIC AS "paidAmount",GREATEST(total-$8,0) AS balance`,
      [
        input.description,
        input.total,
        input.issueDate,
        input.dueDate,
        input.customerNote,
        revisionNumber,
        id,
        Number(current.rows[0].paid_amount),
      ],
    );
    if (input.applyToFuture) {
      await client.query(
        `UPDATE customers SET agreed_price=$1,updated_at=NOW()
         WHERE id=$2`,
        [input.total, current.rows[0].customer_id],
      );
    }
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'invoice_revised','Invoice revised',$2)`,
      [
        current.rows[0].customer_id,
        `Revision ${revisionNumber}: ${input.reason}. Amount AED ${Number(current.rows[0].total).toFixed(2)} → AED ${input.total.toFixed(2)}.`,
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

export async function findInvoiceRevisions(id: number) {
  return (
    await requireDatabase().query(
      `SELECT revision_number AS "revisionNumber",old_description AS "oldDescription",
        new_description AS "newDescription",old_total AS "oldTotal",new_total AS "newTotal",
        old_issue_date AS "oldIssueDate",new_issue_date AS "newIssueDate",
        old_due_date AS "oldDueDate",new_due_date AS "newDueDate",reason,
        changed_by AS "changedBy",changed_at AS "changedAt"
       FROM invoice_revisions WHERE invoice_id=$1 ORDER BY revision_number DESC`,
      [id],
    )
  ).rows;
}
