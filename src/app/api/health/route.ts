import { isDatabaseConnected } from "@/server/config/database";
import { billingMaintenanceStatus } from "@/server/services/billing.service";
import { route } from "@/server/http";
export function GET() {
  return route(async () => {
    let database = false;
    try {
      database = await isDatabaseConnected();
    } catch {
      database = false;
    }
    return {
      ok: database,
      service: "jm-car-wash-next",
      database,
      billing: billingMaintenanceStatus,
    };
  });
}
