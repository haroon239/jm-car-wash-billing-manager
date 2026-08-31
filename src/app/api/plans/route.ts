import { NextRequest } from "next/server";
import * as plans from "@/server/models/plan.model";
import { planSchema } from "@/server/validators/plan.schema";
import { route } from "@/server/http";
export function GET() {
  return route(() => plans.findPlans());
}
export async function POST(request: NextRequest) {
  return route(async () => plans.createPlan(planSchema.parse(await request.json())), 201);
}
