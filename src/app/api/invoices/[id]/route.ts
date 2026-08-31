import { NextRequest } from "next/server";
import * as invoices from "@/server/models/invoice.model";
import { idSchema } from "@/server/validators/customer.schema";
import { invoiceEditSchema } from "@/server/validators/payment.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return route(async () =>
    invoices.editInvoice(
      idSchema.parse((await context.params).id),
      invoiceEditSchema.parse(await request.json()),
    ),
  );
}
