import { NextRequest } from "next/server";
import * as invoices from "@/server/models/invoice.model";
import { createNextCustomerInvoice } from "@/server/services/billing.service";
import { idSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
export function GET() {
  return route(() => invoices.findInvoices());
}
export async function POST(request: NextRequest) {
  return route(async () => {
    const customerId = idSchema.parse((await request.json()).customerId);
    const invoice = await createNextCustomerInvoice(customerId);
    const schedule = await invoices.findCustomerBillingSchedule(customerId);
    return { ...invoice, nextInvoiceDate: schedule?.invoiceDate ?? null };
  }, 201);
}
