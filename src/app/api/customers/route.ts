import { NextRequest } from "next/server";
import * as customers from "@/server/models/customer.model";
import * as activity from "@/server/models/activity.model";
import { customerSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";
import { runBillingMaintenance } from "@/server/services/billing.service";

export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return route(() =>
    customers.findCustomers(
      request.nextUrl.searchParams.get("view") === "archived"
        ? "archived"
        : request.nextUrl.searchParams.get("view") === "all"
          ? "all"
          : "active",
    ),
  );
}
export async function POST(request: NextRequest) {
  return route(async () => {
    const result = await customers.createCustomer(customerSchema.parse(await request.json()));
    let billingWarning = "";
    try {
      await activity.logCustomerActivity(
        Number(result.id),
        "customer_created",
        "Customer added",
        "Customer account and subscription created.",
      );
      await runBillingMaintenance();
    } catch (error) {
      console.error("Customer saved; follow-up processing failed", error);
      billingWarning =
        "Customer saved. Billing may need refreshing. Check the profile; do not add the customer again.";
    }
    return { ...result, billingWarning };
  }, 201);
}
