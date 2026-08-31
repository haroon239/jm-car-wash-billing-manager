import { NextRequest } from "next/server";
import * as customers from "@/server/models/customer.model";
import * as activity from "@/server/models/activity.model";
import { customerSchema } from "@/server/validators/customer.schema";
import { route } from "@/server/http";

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
    await activity.logCustomerActivity(
      Number(result.id),
      "customer_created",
      "Customer added",
      "Customer account and subscription created.",
    );
    return result;
  }, 201);
}
