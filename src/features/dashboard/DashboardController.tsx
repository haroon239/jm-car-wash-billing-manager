"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "../../components/layout/Sidebar";
import { PageHeader } from "../../components/layout/PageHeader";
import { Notice, type NoticeKind } from "../../components/common/Notice";
import { InvoicesPage } from "../../views/InvoicesPage";
import { CustomerProfilePage } from "../../views/CustomerProfilePage";
import { PaymentsPage } from "../../views/PaymentsPage";
import { PlansPage } from "../../views/PlansPage";
import { SettingsPage } from "../../views/SettingsPage";
import { LocationsPage } from "../../views/LocationsPage";
import { ReportsPage } from "../../views/ReportsPage";
import type {
  CompanySettings,
  Customer,
  CustomerForm,
  Invoice,
  CustomerActivity,
  Payment,
  Plan,
  Section,
  LocationSummary,
  Vehicle,
} from "../../types/domain";
import { formatBillingType } from "../../utils/display";
import { calculateNextBillingDate } from "../../utils/billing";

const planPrices: Record<string, number> = {
  Basic: 99,
  Standard: 199,
  Premium: 299,
  Corporate: 1249,
};

function normalizeInvoiceStatus(status?: string | null): Customer["status"] {
  switch (status?.toLowerCase()) {
    case "paid":
      return "Paid";
    case "sent":
      return "Sent";
    case "overdue":
    case "partially_overdue":
      return "Overdue";
    case "partially_paid":
    default:
      return "Pending";
  }
}

function formatDueDate(date?: string | null) {
  if (!date) return "Not generated";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(date));
}

function formatBillingPeriod(invoice: Invoice) {
  const startValue = invoice.billingPeriodStart || invoice.issueDate;
  if (!startValue || invoice.billingType === "manual" || invoice.billingType === "one_time") {
    return null;
  }

  const start = new Date(`${String(startValue).slice(0, 10)}T00:00:00Z`);
  const end = new Date(start);
  if (invoice.billingType === "weekly") {
    end.setUTCDate(end.getUTCDate() + 6);
  } else {
    const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const lastDay = new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0),
    ).getUTCDate();
    end.setTime(
      Date.UTC(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth(),
        Math.min(start.getUTCDate(), lastDay),
      ),
    );
    end.setUTCDate(end.getUTCDate() - 1);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

type CustomerActionKind =
  | "expiring"
  | "expires-today"
  | "expired"
  | "invoice-ready"
  | "payment-pending"
  | "payment-overdue";

type CustomerAction = {
  kind: CustomerActionKind;
  label: string;
  invoice?: Invoice;
};

function daysFromDubaiToday(date: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const todayUtc = Date.UTC(value("year"), value("month") - 1, value("day"));
  const targetUtc = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

export function DashboardController() {
  const invoicePaperRef = useRef<HTMLDivElement>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [active, setActive] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    plate: "",
    buildingNo: "",
    flatNo: "",
    roomNo: "",
    parkingNo: "",
    plan: "Basic",
    planStartDate: new Date().toISOString().slice(0, 10),
    contractEndDate: null,
    washesPerCycle: 4,
    amount: 99,
    billingType: "monthly",
    autoInvoice: true,
    nextInvoiceDate: calculateNextBillingDate(new Date().toISOString().slice(0, 10), "monthly"),
    areaId: 0,
    buildingId: 0,
    vehicles: [{ plateNumber: "", makeModel: "", parkingNumber: "", isPrimary: true }],
  });
  const [notice, setNoticeState] = useState<{ message: string; kind: NoticeKind }>({
    message: "",
    kind: "success",
  });
  const [plans, setPlans] = useState<Plan[]>(
    Object.entries(planPrices).map(([name, price], index) => ({
      id: index + 1,
      name,
      price,
      washesPerMonth: name === "Corporate" ? null : (index + 1) * 4,
    })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", price: "", washesPerMonth: "" });
  const [section, setSection] = useState<Section>("overview");
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [customerView, setCustomerView] = useState<"active" | "archived" | "all">("active");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<number | null>(null);
  const [profileActivities, setProfileActivities] = useState<CustomerActivity[]>([]);
  const [invoiceEditForm, setInvoiceEditForm] = useState({
    description: "",
    customerNote: "",
    total: "",
    issueDate: "",
    dueDate: "",
    reason: "",
    applyToFuture: false,
  });
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    note: "",
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: "JAHAN MUHAMMAD FOR CAR WASHING & CLEANING CO.",
    phone: "+971 52 8843059",
    email: "jmcarwashandcleaning@gmail.com",
    trn: "",
    address: "United Arab Emirates",
    invoicePrefix: "JMCW",
    vatRate: 0,
  });
  const profileCustomer = customers.find((customer) => customer.id === profileCustomerId) ?? null;
  const profileInvoices = profileCustomer
    ? invoices.filter((invoice) => invoice.customerId === profileCustomer.id)
    : [];
  const profileInvoiceIds = new Set(profileInvoices.map((invoice) => invoice.id));
  const profilePayments = payments.filter((payment) => profileInvoiceIds.has(payment.invoiceId));

  useEffect(() => {
    async function loadDatabaseData() {
      try {
        const [
          customersResponse,
          plansResponse,
          invoicesResponse,
          paymentsResponse,
          settingsResponse,
          locationsResponse,
        ] = await Promise.all([
          fetch("/api/customers?view=all"),
          fetch("/api/plans"),
          fetch("/api/invoices"),
          fetch("/api/payments"),
          fetch("/api/settings"),
          fetch("/api/locations"),
        ]);
        if (
          !customersResponse.ok ||
          !plansResponse.ok ||
          !invoicesResponse.ok ||
          !paymentsResponse.ok ||
          !settingsResponse.ok ||
          !locationsResponse.ok
        )
          throw new Error("The business data could not be loaded.");
        const [customerRows, planRows, invoiceRows, paymentRows, settingsRow, locationRows] =
          await Promise.all([
            customersResponse.json(),
            plansResponse.json(),
            invoicesResponse.json(),
            paymentsResponse.json(),
            settingsResponse.json(),
            locationsResponse.json(),
          ]);
        setLocations(
          locationRows.map((location: Record<string, string | number>) => ({
            ...location,
            propertyId: Number(location.propertyId),
            areaId: Number(location.areaId),
            buildingId: Number(location.buildingId),
            activeCustomers: Number(location.activeCustomers),
            expectedRevenue: Number(location.expectedRevenue),
            invoiced: Number(location.invoiced),
            collected: Number(location.collected),
            outstanding: Number(location.outstanding),
            overdue: Number(location.overdue),
          })) as LocationSummary[],
        );
        setSettings({
          ...settingsRow,
          trn: settingsRow.trn ?? "",
          vatRate: 0,
        });
        const normalizedPlans: Plan[] = planRows.map(
          (plan: {
            id: string | number;
            name: string;
            price: string | number;
            washesPerMonth: number | null;
          }) => ({
            id: Number(plan.id),
            name: plan.name,
            price: Number(plan.price),
            washesPerMonth: plan.washesPerMonth,
          }),
        );
        setPlans(normalizedPlans);
        setInvoices(
          invoiceRows.map((invoice: Record<string, string | number | null>) => ({
            ...invoice,
            id: Number(invoice.id),
            customerId: Number(invoice.customerId),
            total: Number(invoice.total),
            paidAmount: Number(invoice.paidAmount ?? 0),
            balance: Number(invoice.balance ?? invoice.total),
            customerNote: String(invoice.customerNote ?? ""),
            description: String(invoice.description ?? "Car Wash Service"),
            revisionNumber: Number(invoice.revisionNumber ?? 0),
          })) as Invoice[],
        );
        setPayments(
          paymentRows.map((payment: Record<string, string | number | null>) => ({
            ...payment,
            id: Number(payment.id),
            invoiceId: Number(payment.invoiceId),
            amount: Number(payment.amount),
            note: payment.note ? String(payment.note) : null,
          })) as Payment[],
        );
        setCustomers(
          customerRows.map(
            (customer: {
              id: string | number;
              name: string;
              phone: string;
              plateNumber: string;
              buildingNo?: string | null;
              flatNo?: string | null;
              roomNo?: string | null;
              parkingNo?: string | null;
              customerSince?: string | null;
              planStartDate?: string;
              contractEndDate?: string | null;
              washesPerCycle?: string | number | null;
              washesCompleted?: string | number;
              archivedAt?: string | null;
              plan?: string;
              price?: string | number;
              invoiceStatus?: string | null;
              invoiceDueDate?: string | null;
              billingType?: Customer["billingType"];
              autoInvoice?: boolean;
              nextInvoiceDate?: string | null;
              propertyName?: string;
              areaId?: string | number;
              areaName?: string;
              buildingId?: string | number;
              buildingName?: string;
              vehicles?: Vehicle[];
            }) => ({
              id: Number(customer.id),
              name: customer.name,
              phone: customer.phone,
              plate: customer.plateNumber,
              buildingNo: customer.buildingNo ?? "",
              flatNo: customer.flatNo ?? "",
              roomNo: customer.roomNo ?? "",
              parkingNo: customer.parkingNo ?? "",
              propertyName: customer.propertyName,
              areaId: customer.areaId ? Number(customer.areaId) : undefined,
              areaName: customer.areaName,
              buildingId: customer.buildingId ? Number(customer.buildingId) : undefined,
              buildingName: customer.buildingName,
              vehicles: Array.isArray(customer.vehicles)
                ? customer.vehicles.map((vehicle) => ({
                    ...vehicle,
                    id: vehicle.id ? Number(vehicle.id) : undefined,
                  }))
                : [],
              customerSince: customer.customerSince ?? new Date().toISOString(),
              plan: customer.plan ?? "No plan",
              planStartDate: customer.planStartDate?.slice(0, 10) ?? "",
              contractEndDate: customer.contractEndDate?.slice(0, 10) ?? null,
              washesPerCycle:
                customer.washesPerCycle == null ? null : Number(customer.washesPerCycle),
              washesCompleted: Number(customer.washesCompleted ?? 0),
              archivedAt: customer.archivedAt,
              amount: Number(customer.price ?? 0),
              billingType: customer.billingType ?? "monthly",
              autoInvoice: customer.autoInvoice ?? true,
              nextInvoiceDate: customer.nextInvoiceDate?.slice(0, 10) ?? "",
              due: formatDueDate(customer.invoiceDueDate),
              status: normalizeInvoiceStatus(customer.invoiceStatus),
            }),
          ),
        );
        setLoadError("");
      } catch (error) {
        setCustomers([]);
        setInvoices([]);
        setPayments([]);
        setLoadError(
          error instanceof Error ? error.message : "The business data could not be loaded.",
        );
      } finally {
        setIsInitialLoading(false);
      }
    }
    void loadDatabaseData();
  }, []);

  function setNotice(message: string, kind: NoticeKind = "success") {
    setNoticeState({ message, kind });
  }

  async function openCustomerProfile(customer: Customer) {
    setSection("customers");
    setProfileCustomerId(customer.id);
    setProfileActivities([]);
    try {
      const response = await fetch(`/api/customers/${customer.id}/activity`);
      if (!response.ok) throw new Error("Unable to load customer activity");
      const rows = await response.json();
      setProfileActivities(
        rows.map((activity: Record<string, string | number | null>) => ({
          ...activity,
          id: Number(activity.id),
        })) as CustomerActivity[],
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load customer activity.",
        "error",
      );
    }
  }

  function openCustomerProfileById(customerId: number) {
    const customer = customers.find((record) => record.id === customerId);
    if (customer) void openCustomerProfile(customer);
    else setNotice("This customer profile is unavailable. Please refresh and try again.", "error");
  }

  function openCustomerWhatsApp(customer: Customer) {
    window.open(`https://wa.me/${customer.phone}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!notice.message || notice.kind === "error") return;
    const timer = window.setTimeout(() => setNoticeState({ message: "", kind: "success" }), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function saveCompanySettings() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, trn: settings.trn ?? "", vatRate: 0 }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to save settings");
      const saved = await response.json();
      setSettings({ ...saved, trn: saved.trn ?? "", vatRate: 0 });
      setNotice("Company and invoice settings saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save settings.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const scopedCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          (selectedAreaId === null || customer.areaId === selectedAreaId) &&
          (selectedBuildingId === null || customer.buildingId === selectedBuildingId),
      ),
    [customers, selectedAreaId, selectedBuildingId],
  );
  const scopedCustomerIds = useMemo(
    () => new Set(scopedCustomers.map((customer) => customer.id)),
    [scopedCustomers],
  );
  const scopedInvoices = useMemo(
    () => invoices.filter((invoice) => scopedCustomerIds.has(invoice.customerId)),
    [invoices, scopedCustomerIds],
  );
  const scopedInvoiceIds = useMemo(
    () => new Set(scopedInvoices.map((invoice) => invoice.id)),
    [scopedInvoices],
  );
  const scopedPayments = useMemo(
    () => payments.filter((payment) => scopedInvoiceIds.has(payment.invoiceId)),
    [payments, scopedInvoiceIds],
  );
  const activeCustomers = useMemo(
    () => scopedCustomers.filter((customer) => !customer.archivedAt),
    [scopedCustomers],
  );
  const customerActions = useMemo(() => {
    const actionableInvoiceByCustomer = new Map<number, Invoice>();
    const priority: Record<string, number> = {
      overdue: 1,
      partially_overdue: 1,
      pending: 2,
      sent: 3,
      partially_paid: 3,
    };
    for (const invoice of scopedInvoices) {
      const status = invoice.status.toLowerCase();
      if (!(status in priority)) continue;
      const current = actionableInvoiceByCustomer.get(invoice.customerId);
      if (!current || priority[status] < priority[current.status.toLowerCase()]) {
        actionableInvoiceByCustomer.set(invoice.customerId, invoice);
      }
    }

    return activeCustomers
      .map((customer) => {
        const invoice = actionableInvoiceByCustomer.get(customer.id);
        const invoiceStatus = invoice?.status.toLowerCase();
        let action: CustomerAction | null = null;

        if (invoiceStatus === "overdue" || invoiceStatus === "partially_overdue") {
          action = { kind: "payment-overdue", label: "Payment overdue", invoice };
        } else if (invoiceStatus === "pending") {
          action = { kind: "invoice-ready", label: "Invoice ready", invoice };
        } else if (invoiceStatus === "sent" || invoiceStatus === "partially_paid") {
          action = { kind: "payment-pending", label: "Payment pending", invoice };
        } else if (customer.nextInvoiceDate) {
          const days = daysFromDubaiToday(customer.nextInvoiceDate);
          if (days < 0) action = { kind: "expired", label: "Billing date passed" };
          else if (days === 0) action = { kind: "expires-today", label: "Billing due today" };
          else if (days <= 3)
            action = {
              kind: "expiring",
              label: `Billing due in ${days} day${days === 1 ? "" : "s"}`,
            };
        }

        return action ? { customer, action } : null;
      })
      .filter((item): item is { customer: Customer; action: CustomerAction } => item !== null);
  }, [activeCustomers, scopedInvoices]);
  const customerActionMap = useMemo(
    () => new Map(customerActions.map((item) => [item.customer.id, item.action])),
    [customerActions],
  );
  const actionCounts = useMemo(
    () => ({
      expiring: customerActions.filter((item) =>
        ["expiring", "expires-today", "expired"].includes(item.action.kind),
      ).length,
      ready: scopedInvoices.filter((invoice) => invoice.status.toLowerCase() === "pending").length,
      overdue: scopedInvoices.filter((invoice) =>
        ["overdue", "partially_overdue"].includes(invoice.status.toLowerCase()),
      ).length,
      pending: scopedInvoices.filter((invoice) =>
        ["sent", "partially_paid"].includes(invoice.status.toLowerCase()),
      ).length,
    }),
    [customerActions, scopedInvoices],
  );
  const invoiceActionCount = actionCounts.ready + actionCounts.pending + actionCounts.overdue;
  const totalActionCount = actionCounts.expiring + invoiceActionCount;
  const filtered = useMemo(
    () =>
      activeCustomers.filter((customer) =>
        `${customer.name} ${customer.phone} ${customer.plate} ${customer.plan}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [activeCustomers, query],
  );
  const customerFiltered = useMemo(
    () =>
      scopedCustomers.filter((customer) => {
        const matchesView =
          customerView === "all" ||
          (customerView === "archived" ? Boolean(customer.archivedAt) : !customer.archivedAt);
        return (
          matchesView &&
          `${customer.name} ${customer.phone} ${customer.plate} ${customer.plan}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [scopedCustomers, customerView, query],
  );
  const customerPageSize = 25;
  const customerTotalPages = Math.max(1, Math.ceil(customerFiltered.length / customerPageSize));
  const visibleCustomers = customerFiltered.slice(
    (customerPage - 1) * customerPageSize,
    customerPage * customerPageSize,
  );

  useEffect(() => setCustomerPage(1), [customerView, query, selectedAreaId, selectedBuildingId]);
  useEffect(() => {
    if (customerPage > customerTotalPages) setCustomerPage(customerTotalPages);
  }, [customerPage, customerTotalPages]);

  function openWhatsApp(customer: Customer) {
    const invoice =
      activeInvoice?.invoiceNumber ?? `JMCW-${new Date().getFullYear()}-${customer.id}`;
    const amount = activeInvoice?.total ?? customer.amount;
    const message = `Hello ${customer.name}, your JM Car Wash invoice ${invoice} for AED ${amount.toFixed(2)} is ready. Thank you.`;
    window.open(
      `https://wa.me/${customer.phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setNotice(`WhatsApp opened for ${customer.name}. Review the message and press Send.`);
  }

  function invoiceFileName(customer: Customer) {
    const cleanFilePart = (value: string) => value.replace(/[\\/:*?"<>|]+/g, "-").trim();
    return [
      cleanFilePart(customer.name),
      cleanFilePart(settings.companyName),
      cleanFilePart(activeInvoice?.invoiceNumber ?? "Invoice"),
    ].join(" - ");
  }

  async function shareInvoice(customer: Customer) {
    if (!activeInvoice || !invoicePaperRef.current) return;
    setIsSaving(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(invoicePaperRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 10;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const imageRatio = canvas.width / canvas.height;
      let imageWidth = pageWidth;
      let imageHeight = imageWidth / imageRatio;
      if (imageHeight > pageHeight) {
        imageHeight = pageHeight;
        imageWidth = imageHeight * imageRatio;
      }
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        (pdf.internal.pageSize.getWidth() - imageWidth) / 2,
        margin,
        imageWidth,
        imageHeight,
      );

      const fileName = `${invoiceFileName(customer)}.pdf`;
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      const shareData = {
        title: activeInvoice.invoiceNumber,
        text: `Invoice ${activeInvoice.invoiceNumber} from ${settings.companyName}`,
        files: [file],
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setNotice("Invoice shared. Mark it as sent after confirming delivery.");
      } else {
        pdf.save(fileName);
        setNotice("PDF downloaded because file sharing is not supported by this browser.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "Unable to share invoice.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleSent(customer: Customer) {
    if (!activeInvoice) return;
    const isUnsend = Boolean(activeInvoice.sentAt);
    const nextStatus = isUnsend ? "pending" : "sent";
    try {
      const response = await fetch(`/api/invoices/${activeInvoice.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Unable to update invoice status");
      const row = await response.json();
      const actualStatus = String(row.status);
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === activeInvoice.id
            ? {
                ...invoice,
                status: actualStatus,
                sentAt: isUnsend ? null : new Date().toISOString(),
              }
            : invoice,
        ),
      );
      setActiveInvoice({
        ...activeInvoice,
        status: actualStatus,
        sentAt: isUnsend ? null : new Date().toISOString(),
      });
      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id
            ? { ...item, status: normalizeInvoiceStatus(actualStatus) }
            : item,
        ),
      );
      setNotice(
        `Invoice ${activeInvoice.invoiceNumber} marked as ${isUnsend ? "unsent" : "sent"} by Admin.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to update invoice delivery status.",
        "error",
      );
    }
  }

  async function prepareInvoice(customer: Customer) {
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to generate invoice");
      const row = await response.json();
      const invoice: Invoice = {
        ...row,
        id: Number(row.id),
        customerId: Number(row.customerId),
        total: Number(row.total),
        paidAmount: Number(row.paidAmount ?? 0),
        balance: Number(row.balance ?? row.total),
        customerNote: String(row.customerNote ?? ""),
        description: String(row.description ?? `${customer.plan} Car Wash Plan`),
        revisionNumber: Number(row.revisionNumber ?? 0),
      };
      setInvoices((current) =>
        current.some((item) => item.id === invoice.id)
          ? current.map((item) => (item.id === invoice.id ? invoice : item))
          : [invoice, ...current],
      );
      setActiveInvoice(invoice);
      const updatedCustomer = {
        ...customer,
        due: formatDueDate(invoice.dueDate),
        nextInvoiceDate: row.nextInvoiceDate
          ? String(row.nextInvoiceDate).slice(0, 10)
          : customer.nextInvoiceDate,
        status: normalizeInvoiceStatus(invoice.status),
      };
      setCustomers((current) =>
        current.map((item) => (item.id === customer.id ? updatedCustomer : item)),
      );
      setActive(updatedCustomer);
      if (row.wasExisting)
        setNotice(`Existing invoice ${invoice.invoiceNumber} opened for this month.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to generate invoice.", "error");
    }
  }

  function openSavedInvoice(invoice: Invoice) {
    const customer = customers.find((item) => item.id === invoice.customerId);
    if (!customer) return setNotice("Customer record for this invoice is unavailable.", "error");
    setActiveInvoice(invoice);
    setActive(customer);
  }

  function openInvoiceEditor(invoice: Invoice) {
    setEditingInvoice(invoice);
    setInvoiceEditForm({
      description: invoice.description,
      customerNote: invoice.customerNote ?? "",
      total: String(invoice.total),
      issueDate: String(invoice.issueDate).slice(0, 10),
      dueDate: String(invoice.dueDate).slice(0, 10),
      reason: "",
      applyToFuture: false,
    });
  }

  async function saveInvoiceEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingInvoice) return;
    if (
      editingInvoice.sentAt &&
      !window.confirm("This invoice was already sent. Save the revision and mark it pending?")
    )
      return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...invoiceEditForm,
          total: Number(invoiceEditForm.total),
        }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to edit invoice");
      const updated = await response.json();
      const nextInvoice: Invoice = {
        ...editingInvoice,
        ...updated,
        total: Number(updated.total),
        paidAmount: Number(updated.paidAmount ?? editingInvoice.paidAmount),
        balance: Number(updated.balance ?? editingInvoice.balance),
        revisionNumber: Number(updated.revisionNumber),
      };
      setInvoices((current) =>
        current.map((invoice) => (invoice.id === nextInvoice.id ? nextInvoice : invoice)),
      );
      if (activeInvoice?.id === nextInvoice.id) setActiveInvoice(nextInvoice);
      if (invoiceEditForm.applyToFuture) {
        setCustomers((current) =>
          current.map((customer) =>
            customer.id === nextInvoice.customerId
              ? { ...customer, amount: nextInvoice.total }
              : customer,
          ),
        );
      }
      setEditingInvoice(null);
      setNotice(
        `Invoice revised to AED ${nextInvoice.total.toFixed(2)}${
          invoiceEditForm.applyToFuture ? " and future price updated" : ""
        }.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to edit invoice.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function recordPayment(invoice: Invoice) {
    setPaymentInvoice(invoice);
    setPaymentForm({
      amount: invoice.balance.toFixed(2),
      method: "cash",
      reference: "",
      note: "",
    });
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentInvoice) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > paymentInvoice.balance) {
      return setNotice(
        `Enter an amount between AED 0.01 and AED ${paymentInvoice.balance.toFixed(2)}.`,
        "error",
      );
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: paymentInvoice.id,
          amount,
          method: paymentForm.method,
          reference: paymentForm.reference,
          note: paymentForm.note,
        }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to record payment");
      const row = await response.json();
      const payment: Payment = {
        ...row,
        id: Number(row.id),
        invoiceId: Number(row.invoiceId),
        amount: Number(row.amount),
        note: row.note ? String(row.note) : null,
        invoiceNumber: paymentInvoice.invoiceNumber,
        customerName: paymentInvoice.customerName,
      };
      setPayments((current) => [payment, ...current]);
      const nextInvoice = {
        ...paymentInvoice,
        status: String(row.invoiceStatus),
        paidAmount: Number(row.paidAmount),
        balance: Number(row.balance),
        customerNote: String(row.customerNote ?? paymentInvoice.customerNote),
      };
      setInvoices((current) =>
        current.map((item) => (item.id === paymentInvoice.id ? nextInvoice : item)),
      );
      if (activeInvoice?.id === paymentInvoice.id) setActiveInvoice(nextInvoice);
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === paymentInvoice.customerId
            ? {
                ...customer,
                status: normalizeInvoiceStatus(String(row.invoiceStatus)),
              }
            : customer,
        ),
      );
      await reloadLocations();
      setPaymentInvoice(null);
      setNotice(
        Number(row.balance) <= 0
          ? `${paymentInvoice.invoiceNumber} is fully paid.`
          : `AED ${amount.toFixed(2)} recorded. Remaining balance AED ${Number(row.balance).toFixed(2)}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to record payment.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function reloadLocations() {
    const response = await fetch("/api/locations");
    if (!response.ok) throw new Error("Unable to refresh locations");
    const rows = await response.json();
    setLocations(
      rows.map((location: Record<string, string | number>) => ({
        ...location,
        propertyId: Number(location.propertyId),
        areaId: Number(location.areaId),
        buildingId: Number(location.buildingId),
        activeCustomers: Number(location.activeCustomers),
        expectedRevenue: Number(location.expectedRevenue),
        invoiced: Number(location.invoiced),
        collected: Number(location.collected),
        outstanding: Number(location.outstanding),
        overdue: Number(location.overdue),
      })) as LocationSummary[],
    );
  }

  async function addArea() {
    const name = window.prompt("Enter the new area or cluster name:");
    if (!name?.trim()) return;
    const propertyId = locations[0]?.propertyId;
    if (!propertyId) return setNotice("No property is configured.", "error");
    try {
      const response = await fetch("/api/locations/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, name: name.trim() }),
      });
      if (!response.ok) throw new Error((await response.json()).message ?? "Unable to add area");
      const area = await response.json();
      const buildingName = window.prompt(
        `Area "${name.trim()}" created. Enter its first building name:`,
      );
      if (buildingName?.trim()) {
        const buildingResponse = await fetch("/api/locations/buildings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ areaId: Number(area.id), name: buildingName.trim() }),
        });
        if (!buildingResponse.ok) throw new Error("Area saved, but building could not be added");
      }
      await reloadLocations();
      setSelectedAreaId(Number(area.id));
      setSelectedBuildingId(null);
      setNotice(`${name.trim()} added successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to add area.", "error");
    }
  }

  async function addBuilding(areaId: number) {
    const name = window.prompt("Enter the building name or number:");
    if (!name?.trim()) return;
    try {
      const response = await fetch("/api/locations/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, name: name.trim() }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to add building");
      await reloadLocations();
      setNotice(`${name.trim()} added successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to add building.", "error");
    }
  }

  async function updateBuilding(buildingId: number, areaId: number, name: string) {
    try {
      const response = await fetch(`/api/locations/buildings/${buildingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, name: name.trim() }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to update building");
      await reloadLocations();
      setSelectedAreaId(areaId);
      setSelectedBuildingId(buildingId);
      setNotice(`${name.trim()} updated successfully.`);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update building.", "error");
      return false;
    }
  }

  async function archiveBuilding(buildingId: number) {
    try {
      const response = await fetch(`/api/locations/buildings/${buildingId}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to archive building");
      setSelectedBuildingId(null);
      await reloadLocations();
      setNotice("Building archived. Its historical records remain available.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to archive building.", "error");
      return false;
    }
  }

  function openCustomerForm(customer?: Customer) {
    const defaultAreaId = selectedAreaId ?? locations[0]?.areaId ?? 0;
    const defaultBuildingId =
      selectedBuildingId ??
      locations.find((location) => location.areaId === defaultAreaId)?.buildingId ??
      0;
    setEditing(customer ?? null);
    setCustomerForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            plate: customer.plate,
            buildingNo: customer.buildingNo,
            flatNo: customer.flatNo,
            roomNo: customer.roomNo,
            parkingNo: customer.parkingNo,
            plan: customer.plan,
            planStartDate: customer.planStartDate,
            contractEndDate: customer.contractEndDate,
            washesPerCycle: customer.washesPerCycle,
            amount: customer.amount,
            billingType: customer.billingType,
            autoInvoice: customer.autoInvoice,
            nextInvoiceDate: customer.nextInvoiceDate,
            areaId: customer.areaId ?? defaultAreaId,
            buildingId: customer.buildingId ?? defaultBuildingId,
            vehicles: customer.vehicles?.length
              ? customer.vehicles
              : [
                  {
                    plateNumber: customer.plate,
                    makeModel: "",
                    parkingNumber: customer.parkingNo,
                    isPrimary: true,
                  },
                ],
          }
        : {
            name: "",
            phone: "",
            plate: "",
            buildingNo: "",
            flatNo: "",
            roomNo: "",
            parkingNo: "",
            plan: "Basic",
            planStartDate: new Date().toISOString().slice(0, 10),
            contractEndDate: null,
            washesPerCycle: plans[0]?.washesPerMonth ?? null,
            amount: plans[0]?.price ?? 0,
            billingType: "monthly",
            autoInvoice: true,
            nextInvoiceDate: calculateNextBillingDate(
              new Date().toISOString().slice(0, 10),
              "monthly",
            ),
            areaId: defaultAreaId,
            buildingId: defaultBuildingId,
            vehicles: [{ plateNumber: "", makeModel: "", parkingNumber: "", isPrimary: true }],
          },
    );
    setShowCustomerForm(true);
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedPlan = plans.find((plan) => plan.name === customerForm.plan);
    if (!selectedPlan) return setNotice("Please select a valid plan.", "error");
    const selectedLocation = locations.find(
      (location) =>
        location.areaId === customerForm.areaId && location.buildingId === customerForm.buildingId,
    );
    if (!selectedLocation) return setNotice("Please select a valid area and building.", "error");
    const vehicles = customerForm.vehicles.filter((vehicle) => vehicle.plateNumber.trim());
    if (!vehicles.length) return setNotice("Please add at least one vehicle.", "error");
    const primaryVehicle = vehicles[0];
    setIsSaving(true);
    try {
      const response = await fetch(editing ? `/api/customers/${editing.id}` : "/api/customers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerForm.name,
          phone: customerForm.phone,
          email: "",
          plateNumber: primaryVehicle.plateNumber,
          buildingNo: selectedLocation.buildingName,
          flatNo: customerForm.flatNo,
          roomNo: customerForm.roomNo,
          parkingNo: primaryVehicle.parkingNumber,
          areaId: customerForm.areaId,
          buildingId: customerForm.buildingId,
          vehicles,
          planId: selectedPlan.id,
          planStartDate: customerForm.planStartDate,
          contractEndDate: customerForm.contractEndDate,
          washesPerCycle: customerForm.washesPerCycle,
          agreedPrice: customerForm.amount,
          billingType: customerForm.billingType,
          autoInvoice: customerForm.billingType === "manual" ? false : customerForm.autoInvoice,
          nextInvoiceDate:
            customerForm.billingType === "manual" ? null : customerForm.nextInvoiceDate,
        }),
      });
      if (!response.ok)
        throw new Error((await response.json()).message ?? "Unable to save customer");
      const saved = await response.json();
      const record: Customer = {
        id: Number(saved.id),
        ...customerForm,
        plate: primaryVehicle.plateNumber,
        parkingNo: primaryVehicle.parkingNumber,
        buildingNo: selectedLocation.buildingName,
        propertyName: selectedLocation.propertyName,
        areaName: selectedLocation.areaName,
        buildingName: selectedLocation.buildingName,
        vehicles,
        amount: customerForm.amount,
        due: "01 Aug 2026",
        status: editing?.status ?? "Pending",
        archivedAt: editing?.archivedAt,
        customerSince: editing?.customerSince ?? saved.created_at ?? new Date().toISOString(),
      };
      setCustomers((current) =>
        editing
          ? current.map((customer) => (customer.id === editing.id ? record : customer))
          : [record, ...current],
      );
      await reloadLocations();
      setNotice(`${customerForm.name} ${editing ? "updated" : "added"} successfully.`);
      setShowCustomerForm(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save customer.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveCustomer(customer: Customer) {
    if (
      !window.confirm(`Archive ${customer.name}? Their historical invoices will remain available.`)
    )
      return;
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to archive customer");
      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id ? { ...item, archivedAt: new Date().toISOString() } : item,
        ),
      );
      setShowCustomerForm(false);
      setNotice(`${customer.name} archived.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to archive customer.", "error");
    }
  }

  async function restoreCustomer(customer: Customer) {
    try {
      const response = await fetch(`/api/customers/${customer.id}/restore`, { method: "PATCH" });
      if (!response.ok) throw new Error("Unable to restore customer");
      setCustomers((current) =>
        current.map((item) => (item.id === customer.id ? { ...item, archivedAt: null } : item)),
      );
      setNotice(`${customer.name} restored to active customers.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to restore customer.", "error");
    }
  }

  function openPlanForm(plan?: Plan) {
    setEditingPlan(plan ?? null);
    setPlanForm(
      plan
        ? {
            name: plan.name,
            price: String(plan.price),
            washesPerMonth: plan.washesPerMonth === null ? "" : String(plan.washesPerMonth),
          }
        : { name: "", price: "", washesPerMonth: "" },
    );
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(editingPlan ? `/api/plans/${editingPlan.id}` : "/api/plans", {
        method: editingPlan ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          price: Number(planForm.price),
          washesPerMonth: planForm.washesPerMonth ? Number(planForm.washesPerMonth) : null,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message ?? "Unable to save plan");
      const saved = await response.json();
      const plan: Plan = {
        id: Number(saved.id),
        name: saved.name,
        price: Number(saved.price),
        washesPerMonth: saved.washesPerMonth,
      };
      setPlans((current) =>
        editingPlan
          ? current.map((item) => (item.id === editingPlan.id ? plan : item))
          : [...current, plan].sort((a, b) => a.price - b.price),
      );
      setEditingPlan(null);
      setPlanForm({ name: "", price: "", washesPerMonth: "" });
      setNotice(`${plan.name} plan ${editingPlan ? "updated" : "created"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save plan.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function deactivatePlan(plan: Plan) {
    if (
      !window.confirm(`Deactivate ${plan.name}? Existing customer records will keep their history.`)
    )
      return;
    try {
      const response = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to deactivate plan");
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setEditingPlan(null);
      setNotice(`${plan.name} plan deactivated.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to deactivate plan.", "error");
    }
  }

  if (isInitialLoading || loadError) {
    return (
      <main className="app-shell">
        <Sidebar
          section={section}
          onNavigate={setSection}
          activeCustomers={0}
          actionCount={0}
          invoiceActionCount={0}
        />
        <section className={`content section-${section}`}>
          <PageHeader
            section={section}
            onAddCustomer={() => undefined}
            onAddPlan={() => undefined}
            hidePrimaryAction
          />
          <section className={`panel ${loadError ? "app-load-error" : "app-loading"}`}>
            {!loadError && <div className="loading-spinner" />}
            <h2>{loadError ? "We could not load your data" : "Loading your business data"}</h2>
            <p>
              {loadError
                ? `${loadError} Please check the connection and try again.`
                : "Please wait a moment. Your records are being prepared."}
            </p>
            {loadError && (
              <button className="primary" onClick={() => window.location.reload()}>
                Retry
              </button>
            )}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar
        section={section}
        onNavigate={setSection}
        activeCustomers={activeCustomers.length}
        actionCount={totalActionCount}
        invoiceActionCount={invoiceActionCount}
      />

      <section className={`content section-${section}`}>
        <PageHeader
          section={section}
          onAddCustomer={() => openCustomerForm()}
          onAddPlan={() => {
            setShowPlans(true);
            openPlanForm();
          }}
          hidePrimaryAction={
            section === "locations" ||
            section === "reports" ||
            (section === "customers" && Boolean(profileCustomer))
          }
        />
        <div className="location-scope-bar">
          <div>
            <strong>Location view</strong>
            <small>Dashboard, customers, invoices and payments follow this selection.</small>
          </div>
          <select
            aria-label="Filter by area"
            value={selectedAreaId ?? ""}
            onChange={(event) => {
              setSelectedAreaId(event.target.value ? Number(event.target.value) : null);
              setSelectedBuildingId(null);
              setProfileCustomerId(null);
            }}
          >
            <option value="">All areas</option>
            {Array.from(
              new Map(locations.map((location) => [location.areaId, location])).values(),
            ).map((location) => (
              <option key={location.areaId} value={location.areaId}>
                {location.areaName}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by building"
            value={selectedBuildingId ?? ""}
            onChange={(event) => {
              const buildingId = event.target.value ? Number(event.target.value) : null;
              setSelectedBuildingId(buildingId);
              const location = locations.find((item) => item.buildingId === buildingId);
              if (location) setSelectedAreaId(location.areaId);
              setProfileCustomerId(null);
            }}
          >
            <option value="">All buildings</option>
            {locations
              .filter((location) => selectedAreaId === null || location.areaId === selectedAreaId)
              .map((location) => (
                <option key={location.buildingId} value={location.buildingId}>
                  {location.buildingName}
                </option>
              ))}
          </select>
          {(selectedAreaId !== null || selectedBuildingId !== null) && (
            <button
              className="secondary"
              onClick={() => {
                setSelectedAreaId(null);
                setSelectedBuildingId(null);
                setProfileCustomerId(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
        <Notice
          message={notice.message}
          kind={notice.kind}
          onClose={() => setNoticeState({ message: "", kind: "success" })}
        />

        {section === "locations" && (
          <LocationsPage
            locations={locations}
            selectedAreaId={selectedAreaId}
            selectedBuildingId={selectedBuildingId}
            onSelectArea={setSelectedAreaId}
            onSelectBuilding={setSelectedBuildingId}
            onAddArea={() => void addArea()}
            onAddBuilding={(areaId) => void addBuilding(areaId)}
            onUseBuilding={(areaId, buildingId) => {
              setSelectedAreaId(areaId);
              setSelectedBuildingId(buildingId);
              setSection("customers");
            }}
            onUpdateBuilding={updateBuilding}
            onArchiveBuilding={archiveBuilding}
          />
        )}

        {section === "customers" && !profileCustomer && (
          <section className="panel section-panel">
            <div className="panel-head">
              <div>
                <h2>Customer directory</h2>
                <p>
                  {activeCustomers.length} active ·{" "}
                  {scopedCustomers.length - activeCustomers.length} archived
                </p>
              </div>
              <div className="view-tabs">
                <button
                  className={customerView === "active" ? "active" : ""}
                  onClick={() => setCustomerView("active")}
                >
                  Active
                </button>
                <button
                  className={customerView === "archived" ? "active" : ""}
                  onClick={() => setCustomerView("archived")}
                >
                  Archived
                </button>
                <button
                  className={customerView === "all" ? "active" : ""}
                  onClick={() => setCustomerView("all")}
                >
                  All
                </button>
              </div>
            </div>
            <div className="toolbar">
              <label>
                ⌕
                <input
                  aria-label="Search customers"
                  placeholder="Search customer, phone or plate"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>WhatsApp</th>
                    <th>Location</th>
                    <th>Plan</th>
                    <th>Plan started</th>
                    <th>Next billing</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className={
                        customerActionMap.get(customer.id)
                          ? `alert-row ${customerActionMap.get(customer.id)?.kind}`
                          : ""
                      }
                    >
                      <td>
                        <div className="customer-cell">
                          <span>
                            {customer.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            <button
                              className="customer-name-button"
                              onClick={() => void openCustomerProfile(customer)}
                            >
                              {customer.name}
                            </button>
                            <small>{customer.plate}</small>
                          </div>
                        </div>
                      </td>
                      <td>{customer.phone}</td>
                      <td>
                        {customer.buildingName ?? customer.buildingNo}
                        <small>{customer.areaName ?? "Unassigned"}</small>
                      </td>
                      <td>
                        {customer.plan}
                        <small>
                          AED {customer.amount.toFixed(2)} ·{" "}
                          {formatBillingType(customer.billingType)}
                        </small>
                      </td>
                      <td>
                        {customer.planStartDate
                          ? new Date(`${customer.planStartDate}T00:00:00`).toLocaleDateString(
                              "en-GB",
                              { day: "2-digit", month: "short", year: "numeric" },
                            )
                          : "—"}
                      </td>
                      <td>
                        {customer.nextInvoiceDate
                          ? new Date(`${customer.nextInvoiceDate}T00:00:00`).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "No automatic billing"}
                        <small>
                          {customer.billingType === "one_time"
                            ? "Service end date"
                            : customer.autoInvoice
                              ? "Renews automatically"
                              : "Automatic billing off"}
                        </small>
                      </td>
                      <td>
                        {customer.archivedAt ? (
                          <i className="status archived">Archived</i>
                        ) : customerActionMap.get(customer.id) ? (
                          <i
                            className={`status action-${customerActionMap.get(customer.id)?.kind}`}
                          >
                            {customerActionMap.get(customer.id)?.label}
                          </i>
                        ) : (
                          <i className="status paid">Active</i>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {customer.archivedAt ? (
                            <button
                              className="restore-button"
                              onClick={() => void restoreCustomer(customer)}
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                className="edit-button"
                                onClick={() => openCustomerForm(customer)}
                              >
                                Edit
                              </button>
                              <button
                                className="send-button"
                                onClick={() => {
                                  const invoice = customerActionMap.get(customer.id)?.invoice;
                                  if (invoice) openSavedInvoice(invoice);
                                  else void prepareInvoice(customer);
                                }}
                              >
                                {customerActionMap.get(customer.id)?.invoice
                                  ? "View invoice"
                                  : customerActionMap.get(customer.id)
                                    ? "Generate invoice"
                                    : "Invoice"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customerFiltered.length === 0 && (
                <div className="empty-state">No {customerView} customers found.</div>
              )}
            </div>
            {customerFiltered.length > 0 && (
              <div className="pagination-bar">
                <p>
                  Showing {(customerPage - 1) * customerPageSize + 1}–
                  {Math.min(customerPage * customerPageSize, customerFiltered.length)} of{" "}
                  {customerFiltered.length}
                </p>
                <div>
                  <button
                    disabled={customerPage === 1}
                    onClick={() => setCustomerPage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  <button className="active" aria-current="page">
                    {customerPage}
                  </button>
                  <button
                    disabled={customerPage === customerTotalPages}
                    onClick={() => setCustomerPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {section === "customers" && profileCustomer && (
          <CustomerProfilePage
            customer={profileCustomer}
            invoices={profileInvoices}
            payments={profilePayments}
            activities={profileActivities}
            onBack={() => setProfileCustomerId(null)}
            onEdit={() => openCustomerForm(profileCustomer)}
            onGenerateInvoice={() => void prepareInvoice(profileCustomer)}
            onWhatsApp={() => openCustomerWhatsApp(profileCustomer)}
            onViewInvoice={openSavedInvoice}
            onMarkPaid={(invoice) => void recordPayment(invoice)}
          />
        )}

        {section === "plans" && (
          <PlansPage
            plans={plans}
            onEdit={(plan) => {
              setShowPlans(true);
              openPlanForm(plan);
            }}
          />
        )}

        {section === "invoices" && (
          <InvoicesPage
            refreshKey={invoices
              .map(
                (invoice) =>
                  `${invoice.id}:${invoice.status}:${invoice.balance}:${invoice.revisionNumber}`,
              )
              .join("|")}
            areaId={selectedAreaId}
            buildingId={selectedBuildingId}
            onView={openSavedInvoice}
            onCustomer={openCustomerProfileById}
            onEdit={openInvoiceEditor}
            onPaid={(invoice) => void recordPayment(invoice)}
          />
        )}

        {section === "payments" && (
          <PaymentsPage
            payments={scopedPayments}
            invoices={scopedInvoices}
            onCustomer={openCustomerProfileById}
          />
        )}

        {section === "reports" && (
          <ReportsPage
            customers={activeCustomers}
            invoices={scopedInvoices}
            payments={scopedPayments}
          />
        )}

        {section === "settings" && (
          <SettingsPage
            settings={settings}
            isSaving={isSaving}
            onChange={setSettings}
            onSave={() => void saveCompanySettings()}
          />
        )}

        {section === "overview" && totalActionCount > 0 && (
          <section className="action-required">
            <div className="action-required-icon">!</div>
            <div>
              <strong>Action required</strong>
              <p>
                {actionCounts.expiring} expiring · {actionCounts.ready} ready to send ·{" "}
                {actionCounts.pending} awaiting payment · {actionCounts.overdue} overdue
              </p>
            </div>
            <button onClick={() => setSection(invoiceActionCount > 0 ? "invoices" : "customers")}>
              {invoiceActionCount > 0 ? "Review invoices" : "Review customers"}
            </button>
          </section>
        )}

        <div className="stats">
          <article>
            <div className="stat-icon aqua">♙</div>
            <div>
              <small>ACTIVE CUSTOMERS</small>
              <strong>{activeCustomers.length}</strong>
              <p>Current active records</p>
            </div>
          </article>
          <article>
            <div className="stat-icon blue">د.إ</div>
            <div>
              <small>MONTHLY REVENUE</small>
              <strong>
                AED{" "}
                {activeCustomers
                  .reduce(
                    (sum, customer) =>
                      sum +
                      (customer.billingType === "monthly"
                        ? customer.amount
                        : customer.billingType === "weekly"
                          ? (customer.amount * 52) / 12
                          : 0),
                    0,
                  )
                  .toFixed(2)}
              </strong>
              <p>Expected monthly equivalent</p>
            </div>
          </article>
          <article>
            <div className="stat-icon amber">◷</div>
            <div>
              <small>PAYMENT PENDING</small>
              <strong>
                AED{" "}
                {scopedInvoices
                  .filter((invoice) =>
                    ["pending", "sent", "partially_paid"].includes(invoice.status),
                  )
                  .reduce((sum, invoice) => sum + invoice.balance, 0)
                  .toFixed(2)}
              </strong>
              <p>{actionCounts.ready + actionCounts.pending} invoices due</p>
            </div>
          </article>
          <article>
            <div className="stat-icon red">!</div>
            <div>
              <small>OVERDUE</small>
              <strong>{actionCounts.overdue}</strong>
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
              <button className="text-button" onClick={() => setSection("invoices")}>
                View all →
              </button>
            </div>
            <div className="toolbar">
              <label>
                ⌕
                <input
                  aria-label="Search customers"
                  placeholder="Search customer, phone or plate"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .filter((customer) => customerActionMap.has(customer.id))
                    .map((customer) => (
                      <tr
                        key={customer.id}
                        className={`alert-row ${customerActionMap.get(customer.id)?.kind}`}
                      >
                        <td>
                          <div className="customer-cell">
                            <span>
                              {customer.name
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <div>
                              <button
                                type="button"
                                className="customer-name-button"
                                onClick={() => void openCustomerProfile(customer)}
                                aria-label={`Open ${customer.name}'s customer profile`}
                              >
                                {customer.name}
                              </button>
                              <small>{customer.plate}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{customer.plan}</strong>
                          <small>{customer.due}</small>
                        </td>
                        <td>
                          <strong>
                            AED{" "}
                            {(
                              customerActionMap.get(customer.id)?.invoice?.balance ??
                              customer.amount
                            ).toFixed(2)}
                          </strong>
                          <small>{customerActionMap.get(customer.id)?.label}</small>
                        </td>
                        <td>
                          <i
                            className={`status action-${customerActionMap.get(customer.id)?.kind}`}
                          >
                            {customerActionMap.get(customer.id)?.label}
                          </i>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="edit-button"
                              onClick={() => openCustomerForm(customer)}
                            >
                              Edit
                            </button>
                            <button
                              className="send-button"
                              onClick={() => {
                                const invoice = customerActionMap.get(customer.id)?.invoice;
                                if (invoice) openSavedInvoice(invoice);
                                else void prepareInvoice(customer);
                              }}
                            >
                              {customerActionMap.get(customer.id)?.invoice
                                ? "View & send"
                                : "Generate invoice"}
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
                <strong>{activeCustomers.length}</strong>
                <small>active</small>
              </div>
            </div>
            <div className="legend">
              {plans.map((plan, index) => (
                <p key={plan.id}>
                  <span
                    className={`dot ${["premium", "standard", "basic", "corporate"][index % 4]}`}
                  ></span>
                  <b>{plan.name}</b>
                  <strong>
                    {activeCustomers.filter((customer) => customer.plan === plan.name).length}
                  </strong>
                </p>
              ))}
            </div>
            <button
              className="secondary"
              onClick={() => {
                setShowPlans(true);
                setEditingPlan(null);
              }}
            >
              Manage plans
            </button>
          </aside>
        </div>
      </section>

      {showCustomerForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowCustomerForm(false)}>
          <section className="customer-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="ready">CUSTOMER RECORD</span>
                <h2>{editing ? "Edit customer" : "Add new customer"}</h2>
                <p>Enter the customer, vehicle and subscription details.</p>
              </div>
              <button onClick={() => setShowCustomerForm(false)}>×</button>
            </div>
            <form className="customer-form" onSubmit={saveCustomer}>
              <h3 className="form-section-title">
                <span>1</span> Customer contact
              </h3>
              <label>
                <span>Customer name</span>
                <input
                  required
                  minLength={2}
                  value={customerForm.name}
                  onChange={(event) =>
                    setCustomerForm({ ...customerForm, name: event.target.value })
                  }
                  placeholder="e.g. Ahmed Khan"
                />
              </label>
              <h3 className="form-section-title">
                <span>2</span> Location
              </h3>
              <label>
                <span>WhatsApp number</span>
                <input
                  required
                  inputMode="tel"
                  pattern="[0-9]{7,15}"
                  minLength={7}
                  maxLength={15}
                  value={customerForm.phone}
                  onChange={(event) =>
                    setCustomerForm({
                      ...customerForm,
                      phone: event.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="e.g. 971501234567 or 923001234567"
                />
                <small>
                  Enter country code followed by the number; +, spaces and dashes are removed
                  automatically.
                </small>
              </label>
              <label>
                <span>Area / cluster</span>
                <select
                  required
                  value={customerForm.areaId || ""}
                  onChange={(event) => {
                    const areaId = Number(event.target.value);
                    setCustomerForm({
                      ...customerForm,
                      areaId,
                      buildingId:
                        locations.find((location) => location.areaId === areaId)?.buildingId ?? 0,
                    });
                  }}
                >
                  <option value="">Select area</option>
                  {Array.from(
                    new Map(locations.map((location) => [location.areaId, location])).values(),
                  ).map((location) => (
                    <option key={location.areaId} value={location.areaId}>
                      {location.areaName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Building</span>
                <select
                  required
                  value={customerForm.buildingId || ""}
                  onChange={(event) =>
                    setCustomerForm({
                      ...customerForm,
                      buildingId: Number(event.target.value),
                    })
                  }
                >
                  <option value="">Select building</option>
                  {locations
                    .filter((location) => location.areaId === customerForm.areaId)
                    .map((location) => (
                      <option key={location.buildingId} value={location.buildingId}>
                        {location.buildingName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span>Flat number (optional)</span>
                <input
                  value={customerForm.flatNo}
                  onChange={(event) =>
                    setCustomerForm({ ...customerForm, flatNo: event.target.value })
                  }
                  placeholder="e.g. 8046"
                />
              </label>
              <label>
                <span>Apartment / room number (optional)</span>
                <input
                  value={customerForm.roomNo}
                  onChange={(event) =>
                    setCustomerForm({ ...customerForm, roomNo: event.target.value })
                  }
                  placeholder="e.g. Room 2"
                />
              </label>
              <h3 className="form-section-title">
                <span>3</span> Vehicles
              </h3>
              <fieldset className="vehicle-editor">
                <legend>Vehicles</legend>
                {customerForm.vehicles.map((vehicle, index) => (
                  <div className="vehicle-row" key={`${index}-${vehicle.id ?? "new"}`}>
                    <label>
                      <span>Plate number {index === 0 ? "(primary)" : ""}</span>
                      <input
                        required
                        value={vehicle.plateNumber}
                        onChange={(event) =>
                          setCustomerForm({
                            ...customerForm,
                            vehicles: customerForm.vehicles.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, plateNumber: event.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="Dubai A 45218"
                      />
                    </label>
                    <label>
                      <span>Vehicle make / model</span>
                      <input
                        value={vehicle.makeModel}
                        onChange={(event) =>
                          setCustomerForm({
                            ...customerForm,
                            vehicles: customerForm.vehicles.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, makeModel: event.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="e.g. Toyota Camry"
                      />
                    </label>
                    <label>
                      <span>Parking number</span>
                      <input
                        value={vehicle.parkingNumber}
                        onChange={(event) =>
                          setCustomerForm({
                            ...customerForm,
                            vehicles: customerForm.vehicles.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, parkingNumber: event.target.value }
                                : item,
                            ),
                          })
                        }
                        placeholder="e.g. P210"
                      />
                    </label>
                    {customerForm.vehicles.length > 1 && (
                      <button
                        type="button"
                        className="danger vehicle-remove"
                        onClick={() =>
                          setCustomerForm({
                            ...customerForm,
                            vehicles: customerForm.vehicles.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setCustomerForm({
                      ...customerForm,
                      vehicles: [
                        ...customerForm.vehicles,
                        { plateNumber: "", makeModel: "", parkingNumber: "" },
                      ],
                    })
                  }
                >
                  + Add another vehicle
                </button>
              </fieldset>
              <h3 className="form-section-title">
                <span>4</span> Plan and billing
              </h3>
              <label>
                <span>Subscription plan</span>
                <select
                  value={customerForm.plan}
                  onChange={(event) => {
                    const plan = plans.find((item) => item.name === event.target.value);
                    setCustomerForm({
                      ...customerForm,
                      plan: event.target.value,
                      amount: plan?.price ?? customerForm.amount,
                      washesPerCycle: plan?.washesPerMonth ?? customerForm.washesPerCycle,
                    });
                  }}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.name}>
                      {plan.name} — AED {plan.price}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Agreed customer price (AED)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.amount}
                  onChange={(event) =>
                    setCustomerForm({ ...customerForm, amount: Number(event.target.value) })
                  }
                />
                <small>This customer can have a different price from the plan template.</small>
              </label>
              <label>
                <span>Billing type</span>
                <select
                  value={customerForm.billingType}
                  onChange={(event) => {
                    const billingType = event.target.value as Customer["billingType"];
                    setCustomerForm({
                      ...customerForm,
                      billingType,
                      autoInvoice: billingType !== "manual",
                      nextInvoiceDate: calculateNextBillingDate(
                        customerForm.planStartDate,
                        billingType,
                      ),
                    });
                  }}
                >
                  <option value="monthly">Monthly recurring</option>
                  <option value="weekly">Weekly recurring</option>
                  <option value="one_time">One-time</option>
                  <option value="manual">Manual only</option>
                </select>
              </label>
              <label>
                <span>Included washes per billing cycle</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={customerForm.washesPerCycle ?? ""}
                  onChange={(event) =>
                    setCustomerForm({
                      ...customerForm,
                      washesPerCycle: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  placeholder="e.g. 12"
                />
                <small>Employee can record each completed wash from the customer profile.</small>
              </label>
              <label>
                <span>Plan start date</span>
                <input
                  required
                  type="date"
                  value={customerForm.planStartDate}
                  onChange={(event) =>
                    setCustomerForm({
                      ...customerForm,
                      planStartDate: event.target.value,
                      nextInvoiceDate: calculateNextBillingDate(
                        event.target.value,
                        customerForm.billingType,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>Contract end date (optional)</span>
                <input
                  type="date"
                  min={customerForm.planStartDate}
                  value={customerForm.contractEndDate ?? ""}
                  onChange={(event) =>
                    setCustomerForm({
                      ...customerForm,
                      contractEndDate: event.target.value || null,
                    })
                  }
                />
                <small>Leave empty for an ongoing contract.</small>
              </label>
              {customerForm.billingType !== "manual" && (
                <>
                  <label>
                    <span>
                      {customerForm.billingType === "one_time"
                        ? "Service end date"
                        : "Next billing date"}
                    </span>
                    <input
                      required
                      type="date"
                      value={customerForm.nextInvoiceDate}
                      onChange={(event) =>
                        setCustomerForm({
                          ...customerForm,
                          nextInvoiceDate: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={customerForm.autoInvoice}
                      onChange={(event) =>
                        setCustomerForm({ ...customerForm, autoInvoice: event.target.checked })
                      }
                    />
                    <span>Generate invoices automatically</span>
                  </label>
                </>
              )}
              <div className="form-actions">
                {editing && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void archiveCustomer(editing)}
                  >
                    Archive customer
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCustomerForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSaving}>
                  {isSaving ? "Saving…" : editing ? "Save changes" : "Add customer"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showPlans && (
        <div className="modal-backdrop" onMouseDown={() => setShowPlans(false)}>
          <section className="plans-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="ready">SUBSCRIPTIONS</span>
                <h2>Manage plans</h2>
                <p>Create plans and update monthly pricing or wash limits.</p>
              </div>
              <button onClick={() => setShowPlans(false)}>×</button>
            </div>
            <div className="plans-manager">
              <div className="plan-list">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    className={editingPlan?.id === plan.id ? "selected" : ""}
                    onClick={() => openPlanForm(plan)}
                  >
                    <span>
                      <strong>{plan.name}</strong>
                      <small>
                        {plan.washesPerMonth === null
                          ? "Custom / unlimited washes"
                          : `${plan.washesPerMonth} washes per month`}
                      </small>
                    </span>
                    <b>AED {plan.price}</b>
                  </button>
                ))}
                <button className="new-plan" onClick={() => openPlanForm()}>
                  ＋ Create new plan
                </button>
              </div>
              <form className="plan-form" onSubmit={savePlan}>
                <h3>{editingPlan ? `Edit ${editingPlan.name}` : "New plan"}</h3>
                <label>
                  <span>Plan name</span>
                  <input
                    required
                    minLength={2}
                    value={planForm.name}
                    onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
                    placeholder="e.g. Gold"
                  />
                </label>
                <label>
                  <span>Monthly price (AED)</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.price}
                    onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })}
                    placeholder="299"
                  />
                </label>
                <label>
                  <span>Washes per month</span>
                  <input
                    type="number"
                    min="1"
                    value={planForm.washesPerMonth}
                    onChange={(event) =>
                      setPlanForm({ ...planForm, washesPerMonth: event.target.value })
                    }
                    placeholder="Leave blank for custom"
                  />
                </label>
                <div className="form-actions">
                  {editingPlan && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deactivatePlan(editingPlan)}
                    >
                      Deactivate
                    </button>
                  )}
                  <button type="submit" className="primary" disabled={isSaving}>
                    {isSaving ? "Saving…" : editingPlan ? "Save changes" : "Create plan"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {editingInvoice && (
        <div className="modal-backdrop" onMouseDown={() => setEditingInvoice(null)}>
          <section className="customer-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="ready">CONTROLLED REVISION</span>
                <h2>Edit {editingInvoice.invoiceNumber}</h2>
                <p>Every change is saved in the invoice revision history.</p>
              </div>
              <button onClick={() => setEditingInvoice(null)}>×</button>
            </div>
            <form className="customer-form" onSubmit={saveInvoiceEdit}>
              <label>
                <span>Description</span>
                <input
                  required
                  value={invoiceEditForm.description}
                  onChange={(event) =>
                    setInvoiceEditForm({
                      ...invoiceEditForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Invoice amount (AED)</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={invoiceEditForm.total}
                  onChange={(event) =>
                    setInvoiceEditForm({ ...invoiceEditForm, total: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Issue date</span>
                <input
                  required
                  type="date"
                  value={invoiceEditForm.issueDate}
                  onChange={(event) =>
                    setInvoiceEditForm({ ...invoiceEditForm, issueDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  required
                  type="date"
                  value={invoiceEditForm.dueDate}
                  onChange={(event) =>
                    setInvoiceEditForm({ ...invoiceEditForm, dueDate: event.target.value })
                  }
                />
              </label>
              <label className="full-field">
                <span>Customer note (printed on invoice)</span>
                <textarea
                  maxLength={500}
                  rows={3}
                  value={invoiceEditForm.customerNote}
                  onChange={(event) =>
                    setInvoiceEditForm({
                      ...invoiceEditForm,
                      customerNote: event.target.value,
                    })
                  }
                  placeholder="e.g. AED 50 received. Remaining balance is due by 10 August 2026."
                />
              </label>
              <label>
                <span>Reason for change</span>
                <input
                  required
                  minLength={3}
                  value={invoiceEditForm.reason}
                  onChange={(event) =>
                    setInvoiceEditForm({ ...invoiceEditForm, reason: event.target.value })
                  }
                  placeholder="e.g. Extra service added"
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={invoiceEditForm.applyToFuture}
                  onChange={(event) =>
                    setInvoiceEditForm({
                      ...invoiceEditForm,
                      applyToFuture: event.target.checked,
                    })
                  }
                />
                <span>Use this amount for future invoices too</span>
              </label>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setEditingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save revision"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {paymentInvoice && (
        <div className="modal-backdrop" onMouseDown={() => setPaymentInvoice(null)}>
          <section className="customer-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="ready">RECORD PAYMENT</span>
                <h2>{paymentInvoice.invoiceNumber}</h2>
                <p>
                  Total AED {paymentInvoice.total.toFixed(2)} · Received AED{" "}
                  {paymentInvoice.paidAmount.toFixed(2)} · Balance AED{" "}
                  {paymentInvoice.balance.toFixed(2)}
                </p>
              </div>
              <button onClick={() => setPaymentInvoice(null)}>×</button>
            </div>
            <form className="customer-form" onSubmit={submitPayment}>
              <label>
                <span>Amount received (AED)</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  max={paymentInvoice.balance}
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, amount: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Payment method</span>
                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, method: event.target.value })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span>Reference (optional)</span>
                <input
                  maxLength={100}
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, reference: event.target.value })
                  }
                  placeholder="Transfer or receipt reference"
                />
              </label>
              <label className="full-field">
                <span>Internal payment note (optional)</span>
                <textarea
                  maxLength={300}
                  rows={3}
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
                  placeholder="e.g. Customer promised remaining amount next week."
                />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setPaymentInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Record payment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {active && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            setActive(null);
            setActiveInvoice(null);
          }}
        >
          <section className="invoice-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="ready">READY TO SEND</span>
                <h2>Invoice {activeInvoice?.invoiceNumber}</h2>
                <p>Review the invoice before sharing it with the customer.</p>
              </div>
              <button
                onClick={() => {
                  setActive(null);
                  setActiveInvoice(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="invoice-paper" ref={invoicePaperRef}>
              <div className="invoice-brand">
                <div className="brand-mark">JM</div>
                <div>
                  <strong>{settings.companyName.toUpperCase()}</strong>
                  <small>
                    {settings.address}
                    <br />
                    {settings.phone} · {settings.email}
                    {settings.trn ? ` · TRN ${settings.trn}` : ""}
                  </small>
                </div>
                <h3>INVOICE</h3>
              </div>
              <div className="invoice-meta">
                <div>
                  <small>BILL TO</small>
                  <strong>{active.name}</strong>
                  <p>
                    {active.phone}
                    <br />
                    {active.plate}
                    {(active.buildingNo || active.flatNo || active.parkingNo) && (
                      <>
                        <br />
                        {[
                          active.buildingNo ? `Building ${active.buildingNo}` : "",
                          active.flatNo ? `Flat ${active.flatNo}` : "",
                          active.parkingNo ? `Parking ${active.parkingNo}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p>
                    <span>Invoice no.</span>
                    <b>{activeInvoice?.invoiceNumber}</b>
                  </p>
                  <p>
                    <span>Issue date</span>
                    <b>
                      {activeInvoice
                        ? new Date(activeInvoice.issueDate).toLocaleDateString("en-GB")
                        : "—"}
                    </b>
                  </p>
                  <p>
                    <span>Due date</span>
                    <b>
                      {activeInvoice
                        ? new Date(activeInvoice.dueDate).toLocaleDateString("en-GB")
                        : "—"}
                    </b>
                  </p>
                  {activeInvoice && formatBillingPeriod(activeInvoice) && (
                    <p>
                      <span>Service period</span>
                      <b>{formatBillingPeriod(activeInvoice)}</b>
                    </p>
                  )}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>
                        {activeInvoice?.description ?? `${active.plan} Car Wash Plan`}
                      </strong>
                      <small>
                        {activeInvoice?.billingType
                          ? `${formatBillingType(activeInvoice.billingType)} billing`
                          : `${formatBillingType(active.billingType)} billing`}
                      </small>
                    </td>
                    <td>1</td>
                    <td>AED {(activeInvoice?.total ?? active.amount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="totals">
                {(activeInvoice?.paidAmount ?? 0) > 0 && (
                  <p>
                    <span>Paid</span>
                    <b>AED {(activeInvoice?.paidAmount ?? 0).toFixed(2)}</b>
                  </p>
                )}
                <p className="total">
                  <span>
                    {(activeInvoice?.paidAmount ?? 0) > 0 ? "Remaining balance" : "Total due"}
                  </span>
                  <b>
                    AED{" "}
                    {(activeInvoice?.balance ?? activeInvoice?.total ?? active.amount).toFixed(2)}
                  </b>
                </p>
              </div>
              {activeInvoice?.customerNote && (
                <div className="invoice-customer-note">
                  <strong>NOTE</strong>
                  <p>{activeInvoice.customerNote}</p>
                </div>
              )}
            </div>
            <div className="send-steps">
              <p>
                <span>1</span>
                <b>Share invoice PDF</b>
                <small>Generate the PDF securely</small>
              </p>
              <p>
                <span>2</span>
                <b>Select WhatsApp</b>
                <small>Choose it from the share menu</small>
              </p>
              <p>
                <span>3</span>
                <b>Confirm delivery</b>
                <small>Then mark the invoice as sent</small>
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={isSaving}
                onClick={() => void shareInvoice(active)}
              >
                {isSaving ? "Preparing PDF..." : "Share invoice PDF"}
              </button>
              <button className="whatsapp" onClick={() => openWhatsApp(active)}>
                Open in WhatsApp ↗
              </button>
              {activeInvoice?.status.toLowerCase() !== "paid" && (
                <button className="primary" onClick={() => void toggleSent(active)}>
                  {activeInvoice?.sentAt ? "Mark as unsent" : "✓ Mark as sent"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
