import type { Section } from "../../types/domain";
type Props = {
  section: Section;
  onNavigate: (section: Section) => void;
  activeCustomers: number;
  actionCount: number;
  invoiceActionCount: number;
};
const items: [Section, string, string][] = [
  ["overview", "⌂", "Overview"],
  ["locations", "▦", "Locations"],
  ["customers", "♙", "Customers"],
  ["plans", "◇", "Plans"],
  ["invoices", "▤", "Invoices"],
  ["payments", "◷", "Payment history"],
  ["reports", "▥", "Reports & export"],
  ["settings", "⚙", "Settings"],
];
export function Sidebar({
  section,
  onNavigate,
  activeCustomers,
  actionCount,
  invoiceActionCount,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">JM</span>
        <div>
          <strong>JM Car Wash</strong>
          <small>Billing Manager</small>
        </div>
      </div>
      <nav>
        {items.map(([id, icon, label]) => (
          <button
            key={id}
            className={`nav-item ${section === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            <span>{icon}</span>
            {label}
            {id === "customers" && <b>{activeCustomers}</b>}
            {id === "invoices" && invoiceActionCount > 0 && <b>{invoiceActionCount}</b>}
            {id === "overview" && actionCount > 0 && <b className="alert-count">{actionCount}</b>}
          </button>
        ))}
      </nav>
      <div className="profile">
        <div className="avatar">HA</div>
        <div>
          <strong>Haroon Ahmed</strong>
          <small>Administrator</small>
        </div>
      </div>
    </aside>
  );
}
