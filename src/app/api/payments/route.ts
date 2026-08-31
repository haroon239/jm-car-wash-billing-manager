import { NextRequest } from "next/server";
import * as payments from "@/server/models/payment.model";
import { paymentSchema } from "@/server/validators/payment.schema";
import { route } from "@/server/http";
export function GET() {
  return route(() => payments.findPayments());
}
export async function POST(request: NextRequest) {
  return route(async () => payments.createPayment(paymentSchema.parse(await request.json())), 201);
}
