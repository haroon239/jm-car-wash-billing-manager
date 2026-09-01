import { z } from "zod";
import { route } from "@/server/http";
import { stopCustomerContract } from "@/server/models/contract.model";
import { idSchema } from "@/server/validators/customer.schema";

const schema = z.object({
  stopDate: z.iso.date(),
  reason: z.string().trim().max(300).optional().default(""),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const input = schema.parse(await request.json());
    return stopCustomerContract(
      idSchema.parse((await context.params).id),
      input.stopDate,
      input.reason,
    );
  });
}
