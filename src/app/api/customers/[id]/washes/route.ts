import { z } from "zod";
import { route } from "@/server/http";
import * as washes from "@/server/models/wash.model";
import { idSchema } from "@/server/validators/customer.schema";

const washSchema = z.object({
  vehicleId: z.coerce.number().int().positive().nullable().optional(),
  washedAt: z.iso.datetime(),
  note: z.string().trim().max(300).optional().default(""),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => washes.findCustomerWashes(idSchema.parse((await context.params).id)));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(
    async () =>
      washes.createWash(
        idSchema.parse((await context.params).id),
        washSchema.parse(await request.json()),
      ),
    201,
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const customerId = idSchema.parse((await context.params).id);
    const washId = idSchema.parse(new URL(request.url).searchParams.get("washId"));
    const deleted = await washes.deleteWash(customerId, washId);
    if (!deleted) throw Object.assign(new Error("Wash record not found"), { status: 404 });
    return deleted;
  });
}
