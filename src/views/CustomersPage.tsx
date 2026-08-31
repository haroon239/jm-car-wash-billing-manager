import type { Customer, CustomerView } from "../types/domain";
import { formatBillingType } from "../utils/display";
type Props = {
  customers: Customer[];
  activeCount: number;
  view: CustomerView;
  query: string;
  onView: (v: CustomerView) => void;
  onQuery: (q: string) => void;
  onEdit: (c: Customer) => void;
  onInvoice: (c: Customer) => void;
  onRestore: (c: Customer) => void;
};
export function CustomersPage(p: Props) {
  return (
    <section className="panel section-panel">
      <div className="panel-head">
        <div>
          <h2>Customer directory</h2>
          <p>
            {p.activeCount} active · {p.customers.length - p.activeCount} archived
          </p>
        </div>
        <div className="view-tabs">
          {(["active", "archived", "all"] as CustomerView[]).map((v) => (
            <button key={v} className={p.view === v ? "active" : ""} onClick={() => p.onView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar">
        <label>
          ⌕
          <input
            aria-label="Search customers"
            placeholder="Search customer, phone or plate"
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>WhatsApp</th>
              <th>Plan</th>
              <th>Plan started</th>
              <th>Next billing</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {p.customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="customer-cell">
                    <span>
                      {c.name
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.plate}</small>
                    </div>
                  </div>
                </td>
                <td>{c.phone}</td>
                <td>
                  {c.plan}
                  <small>
                    AED {c.amount.toFixed(2)} · {formatBillingType(c.billingType)}
                  </small>
                </td>
                <td>
                  {c.planStartDate
                    ? new Date(`${c.planStartDate}T00:00:00`).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td>
                  {c.nextInvoiceDate
                    ? new Date(`${c.nextInvoiceDate}T00:00:00`).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "No automatic billing"}
                  <small>
                    {c.billingType === "one_time"
                      ? "Service end date"
                      : c.autoInvoice
                        ? "Renews automatically"
                        : "Automatic billing off"}
                  </small>
                </td>
                <td>
                  {c.archivedAt ? (
                    <i className="status archived">Archived</i>
                  ) : (
                    <i className="status paid">Active</i>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {c.archivedAt ? (
                      <button className="restore-button" onClick={() => p.onRestore(c)}>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button className="edit-button" onClick={() => p.onEdit(c)}>
                          Edit
                        </button>
                        <button className="send-button" onClick={() => p.onInvoice(c)}>
                          Invoice
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.customers.length === 0 && (
          <div className="empty-state">No {p.view} customers found.</div>
        )}
      </div>
    </section>
  );
}
