import * as payments from "@/server/models/payment.model";
import { route } from "@/server/http";

export function GET(_request: Request, context: { params: Promise<{ group: string }> }) {
  return route(async () => {
    const { group } = await context.params;
    return payments.findPaymentReceipt(group);
  });
}
