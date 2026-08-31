import { NextRequest } from "next/server";
import * as plans from "@/server/models/plan.model";
import { planSchema } from "@/server/validators/plan.schema";
import { idSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return route(async () => {
    const result = await plans.updatePlan(
      idSchema.parse((await context.params).id),
      planSchema.parse(await request.json()),
    );
    if (!result) throw Object.assign(new Error("Plan not found"), { status: 404 });
    return result;
  });
}
export async function DELETE(_request: Request, context: Context) {
  return route(async () => {
    if (!(await plans.deactivatePlan(idSchema.parse((await context.params).id))))
      throw Object.assign(new Error("Plan not found"), { status: 404 });
  }, 204);
}
