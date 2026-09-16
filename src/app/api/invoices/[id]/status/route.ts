import { NextRequest } from "next/server";
import * as invoices from "@/server/models/invoice.model";
import { idSchema } from "@/server/validators/customer.schema";
import { invoiceStatusSchema } from "@/server/validators/payment.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  return route(async () => {
    const result = await invoices.updateInvoiceStatus(
      idSchema.parse((await context.params).id),
      invoiceStatusSchema.parse(await request.json()).status,
    );
    if (!result) throw Object.assign(new Error("Bill not found"), { status: 404 });
    return result;
  });
}
