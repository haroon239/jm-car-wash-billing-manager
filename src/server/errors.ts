import { ZodError } from "zod";

const fieldLabels: Record<string, string> = {
  name: "Name",
  phone: "WhatsApp number",
  email: "Email address",
  plateNumber: "Vehicle number",
  planId: "Subscription plan",
  areaId: "Area",
  buildingId: "Building",
  planStartDate: "Plan start date",
  nextInvoiceDate: "Next billing date",
  contractEndDate: "Contract end date",
  amount: "Payment amount",
  agreedPrice: "Agreed price",
  washesPerCycle: "Included washes",
  method: "Payment method",
  vehicles: "Vehicles",
};

// Never return database details, SQL or credentials to the browser.
export function publicError(error: unknown): { status: number; message: string } {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const key = String(issue?.path.at(-1) ?? "");
    const label = fieldLabels[key] ?? "Information entered";
    const message =
      key === "phone"
        ? "Enter a valid WhatsApp number with its country code (7–15 digits, no spaces or symbols)."
        : issue?.code === "custom"
          ? issue.message
          : `${label}: please enter a valid value.`;
    return { status: 400, message };
  }
  const info =
    error && typeof error === "object"
      ? (error as { code?: string; constraint?: string; status?: number })
      : {};
  if (info.code === "23505") {
    const messages: Record<string, string> = {
      customers_phone_key:
        "This WhatsApp number is already used by another customer. Search for the number in Customers and edit the existing profile, or enter a different number.",
      plans_name_key:
        "A plan with this name already exists. Edit the existing plan or choose a different name.",
      properties_name_key:
        "A property with this name already exists. Choose the existing property or use a different name.",
      areas_property_id_name_key:
        "This area name already exists in this property. Choose the existing area or use a different name.",
      buildings_area_id_name_key:
        "This building name already exists in this area. Choose the existing building or use a different name.",
      invoices_customer_billing_period_unique:
        "A bill already exists for this customer's billing period. Open the existing bill in their profile.",
      invoices_customer_billing_month_unique:
        "A bill already exists for this customer's billing month. Open the existing bill in their profile.",
    };
    return {
      status: 409,
      message:
        messages[info.constraint ?? ""] ??
        "This record already exists. Check the existing records before adding it again.",
    };
  }
  if (info.code === "23503")
    return {
      status: 409,
      message:
        "The selected record is no longer available or is used by other records. Refresh the page and check your selection.",
    };
  if (
    info.code === "23502" ||
    info.code === "23514" ||
    info.code === "22007" ||
    info.code === "22008"
  )
    return {
      status: 400,
      message:
        "Some required information is missing or invalid. Check the form fields and dates, then try again.",
    };
  if (
    info.code === "ECONNREFUSED" ||
    info.code === "ETIMEDOUT" ||
    info.code === "57P03" ||
    info.code === "53300"
  )
    return {
      status: 503,
      message:
        "The database is temporarily unavailable. Refresh and check whether your change was saved before trying again.",
    };
  const status =
    Number.isInteger(info.status) && Number(info.status) >= 400 && Number(info.status) < 500
      ? Number(info.status)
      : 500;
  return {
    status,
    message:
      status < 500 && error instanceof Error
        ? error.message
        : "We could not complete this action. Refresh and check whether your change was saved before trying again. If it continues, contact support.",
  };
}
