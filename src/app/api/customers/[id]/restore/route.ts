import * as customers from "@/server/models/customer.model";
import * as activity from "@/server/models/activity.model";
import { idSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(_request: Request, context: Context) {
  return route(async () => {
    const id = idSchema.parse((await context.params).id);
    const result = await customers.restoreCustomer(id);
    if (!result) throw Object.assign(new Error("Archived customer not found"), { status: 404 });
    await activity.logCustomerActivity(id, "customer_restored", "Customer restored");
    return { id: result.id, restored: true };
  });
}
