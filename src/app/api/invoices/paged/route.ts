import { NextRequest } from "next/server";
import * as invoices from "@/server/models/invoice.model";
import { positiveInteger, route } from "@/server/http";
const statuses = new Set([
  "pending",
  "sent",
  "paid",
  "overdue",
  "partially_paid",
  "partially_overdue",
]);
export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const optionalId = (name: string) => {
    const value = query.get(name);
    return value ? positiveInteger(value, 0) || undefined : undefined;
  };
  const status = query.get("status") ?? "";
  return route(() =>
    invoices.findInvoicePage({
      page: positiveInteger(query.get("page"), 1),
      pageSize: positiveInteger(query.get("pageSize"), 20, 100),
      search: query.get("search")?.trim().slice(0, 100) || undefined,
      status: statuses.has(status) ? status : undefined,
      unpaidOnly: query.get("unpaidOnly") === "true",
      areaId: optionalId("areaId"),
      buildingId: optionalId("buildingId"),
    }),
  );
}
