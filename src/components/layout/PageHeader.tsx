import type { Section } from "../../types/domain";
import { formatDubaiDate, getDubaiGreeting } from "../../utils/display";

const copy: Record<Section, { eyebrow: string; title: string; subtitle: string }> = {
  overview: {
    eyebrow: "",
    title: "",
    subtitle: "Here’s what’s happening with your car wash subscriptions.",
  },
  locations: {
    eyebrow: "PROPERTY MANAGEMENT",
    title: "Locations",
    subtitle: "Manage areas, buildings, customers and location performance.",
  },
  customers: {
    eyebrow: "CUSTOMER MANAGEMENT",
    title: "Customers",
    subtitle: "Manage customer, vehicle and subscription records.",
  },
  plans: {
    eyebrow: "SUBSCRIPTIONS",
    title: "Plans",
    subtitle: "Manage monthly pricing and included car washes.",
  },
  invoices: {
    eyebrow: "BILLING",
    title: "Invoices",
    subtitle: "Prepare, download and track customer invoices.",
  },
  payments: {
    eyebrow: "FINANCE",
    title: "Payment history",
    subtitle: "Review paid, pending and overdue balances.",
  },
  reports: {
    eyebrow: "BUSINESS INSIGHTS",
    title: "Reports & export",
    subtitle: "Review revenue and download business records.",
  },
  settings: {
    eyebrow: "BUSINESS",
    title: "Settings",
    subtitle: "Configure company and invoice information.",
  },
};

export function PageHeader({
  section,
  onAddCustomer,
  onAddPlan,
  hidePrimaryAction = false,
}: {
  section: Section;
  onAddCustomer: () => void;
  onAddPlan: () => void;
  hidePrimaryAction?: boolean;
}) {
  const item = copy[section];
  const eyebrow = section === "overview" ? formatDubaiDate().toUpperCase() : item.eyebrow;
  const title = section === "overview" ? `${getDubaiGreeting()}, Haroon` : item.title;

  return (
    <header>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{item.subtitle}</p>
      </div>
      <div className="header-actions">
        {!hidePrimaryAction && section !== "reports" && (
          <button className="primary" onClick={section === "plans" ? onAddPlan : onAddCustomer}>
            + Add {section === "plans" ? "plan" : "customer"}
          </button>
        )}
      </div>
    </header>
  );
}
