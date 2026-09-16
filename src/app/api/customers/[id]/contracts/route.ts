import { idSchema } from "@/server/validators/customer.schema";
import * as contracts from "@/server/models/contract.model";
import { route } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export function GET(_request: Request, context: Context) {
  return route(async () =>
    contracts.findCustomerContracts(idSchema.parse((await context.params).id)),
  );
}
