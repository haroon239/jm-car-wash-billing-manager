import { useMemo, useState } from "react";
import type { Customer, CustomerActivity, Invoice, Payment } from "../types/domain";

type Tab = "overview" | "invoices" | "payments" | "activity";

type Props = {
  customer: Customer;
  invoices: Invoice[];
  payments: Payment[];
  activities: CustomerActivity[];
  onBack: () => void;
  onEdit: () => void;
  onGenerateInvoice: () => void;
  onWhatsApp: () => void;
  onViewInvoice: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
};

const money = (value: number) => `AED ${value.toFixed(2)}`;
const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

export function CustomerProfilePage({
  customer,
  invoices,
  payments,
  activities,
  onBack,
  onEdit,
  onGenerateInvoice,
  onWhatsApp,
  onViewInvoice,
  onMarkPaid,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const totals = useMemo(() => {
    const invoiced = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const paid = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const overdue = invoices
      .filter((invoice) => ["overdue", "partially_overdue"].includes(invoice.status))
      .reduce((sum, invoice) => sum + invoice.balance, 0);
    return { invoiced, paid, outstanding: invoiced - paid, overdue };
  }, [invoices]);
  const latestInvoice = invoices[0];
  const latestPayment = payments[0];

  return (
    <section className="customer-profile">
      <button className="profile-back" onClick={onBack}>
        ← Back to customers
      </button>

      <div className="profile-hero panel">
        <div className="profile-avatar">
          {customer.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="profile-identity">
          <span className="ready">CUSTOMER 360° PROFILE</span>
          <h2>{customer.name}</h2>
          <p>
            Customer since {date(customer.customerSince)} · {customer.phone} · {customer.plate}
          </p>
        </div>
        <div className="profile-actions">
          <button className="secondary" onClick={onEdit}>
            Edit customer
          </button>
          <button className="whatsapp" onClick={onWhatsApp}>
            WhatsApp
          </button>
          <button className="primary" onClick={onGenerateInvoice}>
            Generate invoice
          </button>
        </div>
      </div>

      <div className="profile-financials">
        <article>
          <small>TOTAL INVOICED</small>
          <strong>{money(totals.invoiced)}</strong>
          <p>{invoices.length} invoice(s)</p>
        </article>
        <article>
          <small>TOTAL PAID</small>
          <strong>{money(totals.paid)}</strong>
          <p>Last payment {date(latestPayment?.paidAt)}</p>
        </article>
        <article>
          <small>OUTSTANDING</small>
          <strong>{money(totals.outstanding)}</strong>
          <p>Pending customer balance</p>
        </article>
        <article className={totals.overdue > 0 ? "critical" : ""}>
          <small>OVERDUE</small>
          <strong>{money(totals.overdue)}</strong>
          <p>{totals.overdue > 0 ? "Needs attention" : "No overdue balance"}</p>
        </article>
      </div>

      <div className="profile-tabs">
        {(["overview", "invoices", "payments", "activity"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="profile-overview-grid">
          <section className="panel profile-detail-card">
            <h3>Contact & location</h3>
            <dl>
              <div>
                <dt>WhatsApp</dt>
                <dd>{customer.phone}</dd>
              </div>
              <div>
                <dt>Property</dt>
                <dd>{customer.propertyName || "—"}</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{customer.areaName || "—"}</dd>
              </div>
              <div>
                <dt>Building</dt>
                <dd>{customer.buildingName || customer.buildingNo || "—"}</dd>
              </div>
              <div>
                <dt>Flat</dt>
                <dd>{customer.flatNo || "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="panel profile-detail-card">
            <h3>Vehicles ({customer.vehicles?.length || 1})</h3>
            <dl>
              {(customer.vehicles?.length
                ? customer.vehicles
                : [
                    {
                      plateNumber: customer.plate,
                      makeModel: "",
                      parkingNumber: customer.parkingNo,
                    },
                  ]
              ).map((vehicle, index) => (
                <div key={vehicle.id ?? `${vehicle.plateNumber}-${index}`}>
                  <dt>{index === 0 ? "Primary vehicle" : `Vehicle ${index + 1}`}</dt>
                  <dd>
                    {vehicle.plateNumber}
                    {vehicle.makeModel ? ` · ${vehicle.makeModel}` : ""}
                    {vehicle.parkingNumber ? ` · Parking ${vehicle.parkingNumber}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="panel profile-detail-card">
            <h3>Subscription</h3>
            <dl>
              <div>
                <dt>Plan</dt>
                <dd>{customer.plan}</dd>
              </div>
              <div>
                <dt>Agreed price</dt>
                <dd>{money(customer.amount)}</dd>
              </div>
              <div>
                <dt>Billing type</dt>
                <dd>{customer.billingType.replace("_", " ")}</dd>
              </div>
              <div>
                <dt>Plan started</dt>
                <dd>{date(customer.planStartDate)}</dd>
              </div>
              <div>
                <dt>Next renewal</dt>
                <dd>{date(customer.nextInvoiceDate)}</dd>
              </div>
            </dl>
          </section>
          <section className="panel profile-detail-card">
            <h3>Latest billing</h3>
            {latestInvoice ? (
              <>
                <p>
                  <strong>{latestInvoice.invoiceNumber}</strong>
                </p>
                <p>
                  {money(latestInvoice.total)} · {latestInvoice.status}
                </p>
                <button className="send-button" onClick={() => onViewInvoice(latestInvoice)}>
                  View latest invoice
                </button>
              </>
            ) : (
              <p>No invoice generated yet.</p>
            )}
          </section>
        </div>
      )}

      {tab === "invoices" && (
        <section className="panel profile-list">
          <div className="panel-head">
            <div>
              <h2>Invoice history</h2>
              <p>Complete billing record</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Issue / due</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoiceNumber}</strong>
                      <small>{invoice.description}</small>
                    </td>
                    <td>
                      {date(invoice.issueDate)}
                      <small>Due {date(invoice.dueDate)}</small>
                    </td>
                    <td>
                      <strong>{money(invoice.total)}</strong>
                    </td>
                    <td>
                      <i className={`status ${invoice.status}`}>{invoice.status}</i>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="send-button" onClick={() => onViewInvoice(invoice)}>
                          View
                        </button>
                        {invoice.status !== "paid" && (
                          <button className="paid-button" onClick={() => onMarkPaid(invoice)}>
                            Record payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 && <div className="empty-state">No invoices found.</div>}
        </section>
      )}

      {tab === "payments" && (
        <section className="panel profile-list">
          <div className="panel-head">
            <div>
              <h2>Payment history</h2>
              <p>All received payments</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{date(payment.paidAt)}</td>
                    <td>{payment.invoiceNumber}</td>
                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>
                    <td>{payment.method.replace("_", " ")}</td>
                    <td>{payment.reference || "—"}</td>
                    <td>{payment.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length === 0 && <div className="empty-state">No payments received yet.</div>}
        </section>
      )}

      {tab === "activity" && (
        <section className="panel profile-list">
          <div className="panel-head">
            <div>
              <h2>Activity timeline</h2>
              <p>Customer account audit trail</p>
            </div>
          </div>
          <div className="activity-timeline">
            {activities.map((activity) => (
              <article key={activity.id}>
                <span></span>
                <div>
                  <strong>{activity.title}</strong>
                  <p>{activity.details}</p>
                  <small>
                    {date(activity.createdAt)} · {activity.actor}
                  </small>
                </div>
              </article>
            ))}
            {activities.length === 0 && (
              <div className="empty-state">No activity recorded yet..</div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
