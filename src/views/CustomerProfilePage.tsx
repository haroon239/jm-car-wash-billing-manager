import { useEffect, useMemo, useState } from "react";
import { PaymentReminder } from "../components/common/PaymentReminder";
import type { Customer, CustomerActivity, Invoice, Payment, WashRecord } from "../types/domain";

type Tab = "overview" | "washes" | "invoices" | "payments" | "activity";

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
  onReminderChange: (invoiceId: number, sentAt: string | null) => void;
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
  onReminderChange,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [washes, setWashes] = useState<WashRecord[]>([]);
  const [washBusy, setWashBusy] = useState(false);
  useEffect(() => {
    void fetch(`/api/customers/${customer.id}/washes`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setWashes);
  }, [customer.id]);

  async function recordWash() {
    const note = window.prompt("Optional wash note (staff name, special service, etc.)", "") ?? "";
    setWashBusy(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}/washes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: customer.vehicles?.[0]?.id ?? null,
          washedAt: new Date().toISOString(),
          note,
        }),
      });
      if (!response.ok) throw new Error("Unable to record wash");
      const saved = await response.json();
      setWashes((current) => [saved, ...current]);
      setTab("washes");
    } finally {
      setWashBusy(false);
    }
  }

  async function stopContract() {
    const suggested = new Date().toISOString().slice(0, 10);
    const stopDate = window.prompt("Last active service date (YYYY-MM-DD)", suggested);
    if (!stopDate) return;
    const reason = window.prompt("Reason for stopping (optional)", "Customer requested stop") ?? "";
    if (
      !window.confirm(
        `Stop this contract on ${stopDate} and create/adjust the prorated final bill?`,
      )
    )
      return;
    const response = await fetch(`/api/customers/${customer.id}/stop-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stopDate, reason }),
    });
    const result = await response.json();
    if (!response.ok) return window.alert(result.message ?? "Unable to stop contract");
    window.alert(
      `Final bill ${result.invoiceNumber}: AED ${Number(result.amount).toFixed(2)} (${result.usedDays}/${result.totalDays} days).`,
    );
    window.location.reload();
  }
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
          <button className="secondary" disabled={washBusy} onClick={() => void recordWash()}>
            {washBusy ? "Saving…" : "+ Record wash"}
          </button>
          {!customer.contractEndDate && (
            <button className="secondary" onClick={() => void stopContract()}>
              Stop contract
            </button>
          )}
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
        {(["overview", "washes", "invoices", "payments", "activity"] as Tab[]).map((item) => (
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
              <div>
                <dt>Room</dt>
                <dd>{customer.roomNo || "—"}</dd>
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
                <dt>Contract ends</dt>
                <dd>{date(customer.contractEndDate)}</dd>
              </div>
              <div>
                <dt>Wash usage</dt>
                <dd>
                  {washes.length} completed
                  {customer.washesPerCycle ? ` / ${customer.washesPerCycle} included` : ""}
                </dd>
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

      {tab === "washes" && (
        <section className="panel profile-list">
          <div className="panel-head">
            <div>
              <h2>Car wash history</h2>
              <p>
                {washes.length} wash(es) recorded
                {customer.washesPerCycle ? ` · ${customer.washesPerCycle} included per cycle` : ""}
              </p>
            </div>
            <button className="primary" disabled={washBusy} onClick={() => void recordWash()}>
              + Record wash
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date & time</th>
                  <th>Vehicle</th>
                  <th>Note</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {washes.map((wash) => (
                  <tr key={wash.id}>
                    <td>{new Date(wash.washedAt).toLocaleString("en-GB")}</td>
                    <td>{wash.plateNumber || customer.plate}</td>
                    <td>{wash.note || "—"}</td>
                    <td>{wash.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {washes.length === 0 && <div className="empty-state">No washes recorded yet.</div>}
        </section>
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
                        <PaymentReminder
                          invoice={invoice}
                          phone={customer.phone}
                          onChange={onReminderChange}
                        />
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
