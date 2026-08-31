import * as activity from "@/server/models/activity.model";
import { idSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return route(async () =>
    activity.findCustomerActivities(idSchema.parse((await context.params).id)),
  );
}
