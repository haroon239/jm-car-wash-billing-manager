import { useEffect, useMemo, useState } from "react";
import type { Customer, Invoice, Payment } from "../types/domain";
import { formatInvoiceStatus, getDubaiIsoDate } from "../utils/display";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(fileName: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function dateValue(value: string) {
  return String(value).slice(0, 10);
}

export function ReportsPage({
  customers,
  invoices,
  payments,
}: {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
}) {
  const today = getDubaiIsoDate();
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [billingHealth, setBillingHealth] = useState<{
    database: boolean;
    billing?: {
      running: boolean;
      lastCompletedAt: string | null;
      lastGeneratedCount: number;
      lastOverdueCount: number;
      lastError: string | null;
    };
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadHealth = () =>
      fetch("/api/health", { signal: controller.signal })
        .then((response) => response.json())
        .then(setBillingHealth)
        .catch(() => setBillingHealth(null));
    void loadHealth();
    const timer = window.setInterval(() => void loadHealth(), 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) => dateValue(invoice.issueDate) >= from && dateValue(invoice.issueDate) <= to,
      ),
    [from, invoices, to],
  );
  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (payment) => dateValue(payment.paidAt) >= from && dateValue(payment.paidAt) <= to,
      ),
    [from, payments, to],
  );
  const invoiced = filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const received = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = filteredInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdue = filteredInvoices
    .filter((invoice) => invoice.status.includes("overdue"))
    .reduce((sum, invoice) => sum + invoice.balance, 0);

  const exportInvoices = () =>
    downloadCsv(`JM-Car-Wash-Invoices-${from}-to-${to}.csv`, [
      [
        "Invoice",
        "Issue date",
        "Due date",
        "Customer",
        "Plate",
        "Total AED",
        "Paid AED",
        "Balance AED",
        "Status",
      ],
      ...filteredInvoices.map((invoice) => [
        invoice.invoiceNumber,
        dateValue(invoice.issueDate),
        dateValue(invoice.dueDate),
        invoice.customerName,
        invoice.plateNumber,
        invoice.total.toFixed(2),
        invoice.paidAmount.toFixed(2),
        invoice.balance.toFixed(2),
        formatInvoiceStatus(invoice.status),
      ]),
    ]);

  const exportCustomers = () =>
    downloadCsv(`JM-Car-Wash-Customers-${today}.csv`, [
      [
        "Customer",
        "WhatsApp",
        "Area",
        "Building",
        "Flat",
        "Vehicle / plate",
        "Plan",
        "Agreed price AED",
        "Billing",
        "Next billing",
      ],
      ...customers.map((customer) => [
        customer.name,
        customer.phone,
        customer.areaName,
        customer.buildingName,
        customer.flatNo,
        customer.plate,
        customer.plan,
        customer.amount.toFixed(2),
        customer.billingType,
        customer.nextInvoiceDate,
      ]),
    ]);

  return (
    <section className="section-panel reports-page">
      <section className="panel report-toolbar">
        <div>
          <h2>Business report</h2>
          <p>Select a period to review invoices and payments in the current location view.</p>
        </div>
        <label>
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </section>

      <div className="report-kpis">
        <article>
          <small>INVOICED</small>
          <strong>AED {invoiced.toFixed(2)}</strong>
          <p>{filteredInvoices.length} invoices</p>
        </article>
        <article>
          <small>RECEIVED</small>
          <strong>AED {received.toFixed(2)}</strong>
          <p>{filteredPayments.length} payments</p>
        </article>
        <article>
          <small>OUTSTANDING</small>
          <strong>AED {outstanding.toFixed(2)}</strong>
          <p>Still to collect</p>
        </article>
        <article className={overdue > 0 ? "warning" : ""}>
          <small>OVERDUE</small>
          <strong>AED {overdue.toFixed(2)}</strong>
          <p>Needs follow-up</p>
        </article>
      </div>

      <section className="panel export-panel">
        <div>
          <h2>Download records</h2>
          <p>
            CSV files open directly in Microsoft Excel and preserve the current location selection.
          </p>
        </div>
        <button className="secondary" onClick={exportCustomers}>
          Download customers
        </button>
        <button className="primary" onClick={exportInvoices}>
          Download invoice report
        </button>
      </section>

      <section className="panel billing-health-card">
        <div>
          <span className={`health-dot ${billingHealth?.database ? "healthy" : "warning"}`} />
          <div>
            <h2>Automatic billing health</h2>
            <p>
              {billingHealth?.billing?.lastError
                ? "The last automatic billing check needs attention."
                : billingHealth?.billing?.running
                  ? "Automatic billing is checking customer records now."
                  : billingHealth?.billing?.lastCompletedAt
                    ? "Automatic invoice checking is operating normally."
                    : "Automatic billing is starting its first check."}
            </p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Last successful check</dt>
            <dd>
              {billingHealth?.billing?.lastCompletedAt
                ? new Date(billingHealth.billing.lastCompletedAt).toLocaleString("en-GB")
                : "Waiting for first check"}
            </dd>
          </div>
          <div>
            <dt>Invoices created</dt>
            <dd>{billingHealth?.billing?.lastGeneratedCount ?? 0}</dd>
          </div>
          <div>
            <dt>Marked overdue</dt>
            <dd>{billingHealth?.billing?.lastOverdueCount ?? 0}</dd>
          </div>
        </dl>
      </section>
    </section>
  );
}
