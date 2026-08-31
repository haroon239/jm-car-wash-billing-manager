import * as invoices from "@/server/models/invoice.model";
import { idSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return route(async () =>
    invoices.findInvoiceRevisions(idSchema.parse((await context.params).id)),
  );
}
