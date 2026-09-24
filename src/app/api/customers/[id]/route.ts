import { NextRequest } from "next/server";
import * as customers from "@/server/models/customer.model";
import * as activity from "@/server/models/activity.model";
import {
  customerDeletionSchema,
  customerSchema,
  idSchema,
} from "@/server/validators/customer.schema";
import { route } from "@/server/http";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return route(async () => {
    const id = idSchema.parse((await context.params).id);
    const result = await customers.updateCustomer(id, customerSchema.parse(await request.json()));
    if (!result) throw Object.assign(new Error("Customer not found"), { status: 404 });
    await activity.logCustomerActivity(
      id,
      "customer_updated",
      "Customer details updated",
      "Contact, vehicle, plan, price or billing details were updated.",
    );
    return result;
  });
}
export async function DELETE(request: NextRequest, context: Context) {
  return route(async () => {
    const id = idSchema.parse((await context.params).id);
    if (request.nextUrl.searchParams.get("permanent") === "true") {
      const { confirmationName } = customerDeletionSchema.parse(await request.json());
      if (!(await customers.permanentlyDeleteCustomer(id, confirmationName)))
        throw Object.assign(new Error("Customer not found"), { status: 404 });
      return;
    }
    if (!(await customers.archiveCustomer(id)))
      throw Object.assign(new Error("Customer not found"), { status: 404 });
    await activity.logCustomerActivity(id, "customer_archived", "Customer archived");
  }, 204);
}
