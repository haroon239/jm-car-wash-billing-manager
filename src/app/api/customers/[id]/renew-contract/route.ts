import { NextRequest } from "next/server";
import { customerSchema, idSchema } from "@/server/validators/customer.schema";
import * as contracts from "@/server/models/contract.model";
import { route } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export function POST(request: NextRequest, context: Context) {
  return route(async () => {
    const id = idSchema.parse((await context.params).id);
    return contracts.renewCustomerContract(id, customerSchema.parse(await request.json()));
  }, 201);
}
