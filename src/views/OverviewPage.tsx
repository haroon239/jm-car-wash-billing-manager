import type { Customer, Plan } from "../types/domain";
type Props = {
  customers: Customer[];
  plans: Plan[];
  query: string;
  onQuery: (q: string) => void;
  onEdit: (c: Customer) => void;
  onInvoice: (c: Customer) => void;
  onManagePlans: () => void;
};
export function OverviewPage(p: Props) {
  return (
    <>
      <div className="stats">
        <article>
          <div className="stat-icon aqua">♙</div>
          <div>
            <small>ACTIVE CUSTOMERS</small>
            <strong>{p.customers.length}</strong>
            <p>
              <em>Live</em> from database
            </p>
          </div>
        </article>
        <article>
          <div className="stat-icon blue">د.إ</div>
          <div>
            <small>MONTHLY REVENUE</small>
            <strong>AED {p.customers.reduce((s, c) => s + c.amount, 0).toFixed(0)}</strong>
            <p>Expected recurring revenue</p>
          </div>
        </article>
        <article>
          <div className="stat-icon amber">◷</div>
          <div>
            <small>PAYMENT PENDING</small>
            <strong>{p.customers.filter((c) => c.status !== "Paid").length}</strong>
            <p>Invoices due</p>
          </div>
        </article>
        <article>
          <div className="stat-icon red">!</div>
          <div>
            <small>OVERDUE</small>
            <strong>{p.customers.filter((c) => c.status === "Overdue").length}</strong>
            <p>Needs attention</p>
          </div>
        </article>
      </div>
      <div className="workspace-grid">
        <section className="panel customers-panel">
          <div className="panel-head">
            <div>
              <h2>Invoices to send</h2>
              <p>Review, download and share through WhatsApp</p>
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
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
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
                    <td>
                      <strong>{c.plan}</strong>
                      <small>{c.due}</small>
                    </td>
                    <td>
                      <strong>AED {c.amount.toFixed(2)}</strong>
                      <small>Ready to generate</small>
                    </td>
                    <td>
                      <i className={`status ${c.status.toLowerCase()}`}>{c.status}</i>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="edit-button" onClick={() => p.onEdit(c)}>
                          Edit
                        </button>
                        <button className="send-button" onClick={() => p.onInvoice(c)}>
                          Prepare invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="panel plans-panel">
          <div className="panel-head">
            <div>
              <h2>Plan breakdown</h2>
              <p>Active subscriptions</p>
            </div>
          </div>
          <div className="donut">
            <div>
              <strong>{p.customers.length}</strong>
              <small>active</small>
            </div>
          </div>
          <div className="legend">
            {p.plans.map((plan, index) => (
              <p key={plan.id}>
                <span
                  className={`dot ${["premium", "standard", "basic", "corporate"][index % 4]}`}
                />
                <b>{plan.name}</b>
                <strong>{p.customers.filter((c) => c.plan === plan.name).length}</strong>
              </p>
            ))}
          </div>
          <button className="secondary" onClick={p.onManagePlans}>
            Manage plans
          </button>
        </aside>
      </div>
    </>
  );
}
