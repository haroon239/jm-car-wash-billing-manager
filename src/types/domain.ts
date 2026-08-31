export type Customer = {
  id: number;
  name: string;
  phone: string;
  plate: string;
  buildingNo: string;
  flatNo: string;
  parkingNo: string;
  propertyName?: string;
  areaId?: number;
  areaName?: string;
  buildingId?: number;
  buildingName?: string;
  vehicles?: Vehicle[];
  customerSince: string;
  plan: string;
  amount: number;
  due: string;
  planStartDate: string;
  billingType: "monthly" | "weekly" | "one_time" | "manual";
  autoInvoice: boolean;
  nextInvoiceDate: string;
  status: "Paid" | "Pending" | "Sent" | "Overdue";
  archivedAt?: string | null;
};
export type CustomerForm = Pick<
  Customer,
  | "name"
  | "phone"
  | "plate"
  | "buildingNo"
  | "flatNo"
  | "parkingNo"
  | "plan"
  | "planStartDate"
  | "amount"
  | "billingType"
  | "autoInvoice"
  | "nextInvoiceDate"
> & {
  areaId: number;
  buildingId: number;
  vehicles: Vehicle[];
};
export type Vehicle = {
  id?: number;
  plateNumber: string;
  makeModel: string;
  parkingNumber: string;
  isPrimary?: boolean;
};
export type LocationSummary = {
  propertyId: number;
  propertyName: string;
  areaId: number;
  areaName: string;
  buildingId: number;
  buildingName: string;
  activeCustomers: number;
  expectedRevenue: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
};
export type Plan = { id: number; name: string; price: number; washesPerMonth: number | null };
export type Invoice = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  plateNumber: string;
  planName: string;
  total: number;
  status: string;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingType: Customer["billingType"];
  customerNote: string;
  paidAmount: number;
  balance: number;
  sentAt?: string | null;
  description: string;
  revisionNumber: number;
};
export type Payment = {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paidAt: string;
  recordedBy: string;
};
export type CustomerActivity = {
  id: number;
  activityType: string;
  title: string;
  details?: string | null;
  actor: string;
  createdAt: string;
};
export type Section =
  | "overview"
  | "locations"
  | "customers"
  | "plans"
  | "invoices"
  | "payments"
  | "reports"
  | "settings";
export type CustomerView = "active" | "archived" | "all";
export type CompanySettings = {
  companyName: string;
  phone: string;
  email: string;
  trn: string;
  address: string;
  invoicePrefix: string;
  vatRate: number;
};
