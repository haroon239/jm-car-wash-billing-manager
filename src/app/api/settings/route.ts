import { NextRequest } from "next/server";
import * as settings from "@/server/models/settings.model";
import { settingsSchema } from "@/server/validators/settings.schema";
import { route } from "@/server/http";
export function GET() {
  return route(() => settings.getSettings());
}
export async function PUT(request: NextRequest) {
  return route(async () => settings.saveSettings(settingsSchema.parse(await request.json())));
}
