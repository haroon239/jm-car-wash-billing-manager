import { useMemo, useState } from "react";
import type { Invoice, Payment } from "../types/domain";
import { formatBillingType } from "../utils/display";
export function PaymentsPage({ payments, invoices }: { payments: Payment[]; invoices: Invoice[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) =>
        `${payment.customerName} ${payment.invoiceNumber} ${payment.reference ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [payments, query],
  );
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visiblePayments = filteredPayments.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="section-panel">
      <div className="payment-summary">
        <article>
          <small>COLLECTED</small>
          <strong>AED {payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}</strong>
          <p>{payments.length} recorded payments</p>
        </article>
        <article>
          <small>AWAITING PAYMENT</small>
          <strong>
            AED{" "}
            {invoices
              .filter((i) => i.status !== "paid")
              .reduce((s, i) => s + i.balance, 0)
              .toFixed(2)}
          </strong>
          <p>Pending, sent and overdue invoices</p>
        </article>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Payment history</h2>
            <p>Permanent payment records from PostgreSQL</p>
          </div>
        </div>
        <div className="toolbar">
          <label>
            <input
              aria-label="Search payments"
              placeholder="Search customer, invoice or reference"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Note</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {new Date(p.paidAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <strong>{p.customerName}</strong>
                  </td>
                  <td>{p.invoiceNumber}</td>
                  <td>
                    <span className="method-badge">{formatBillingType(p.method)}</span>
                  </td>
                  <td>{p.reference || "—"}</td>
                  <td>{p.note || "—"}</td>
                  <td>
                    <strong>AED {p.amount.toFixed(2)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPayments.length === 0 && (
            <div className="empty-state">No matching payments found.</div>
          )}
        </div>
        {filteredPayments.length > 0 && (
          <div className="pagination-bar">
            <p>
              Showing {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filteredPayments.length)} of {filteredPayments.length}
            </p>
            <div>
              <button disabled={safePage === 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </button>
              <button className="active" aria-current="page">
                {safePage}
              </button>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
