import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/config/env";
import { runBillingMaintenance } from "@/server/services/billing.service";
import { route } from "@/server/http";
export const runtime = "nodejs";
export const maxDuration = 300;
export function GET(request: NextRequest) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return route(
    async () => {
      await runBillingMaintenance();
      return { ok: true };
    },
    200,
    { skipAuth: true },
  );
}
