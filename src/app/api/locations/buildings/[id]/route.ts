import { NextRequest } from "next/server";
import * as locations from "@/server/models/location.model";
import { buildingIdSchema, buildingSchema } from "@/server/validators/location.schema";
import { route } from "@/server/http";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) {
  return route(async () => {
    const input = buildingSchema.parse(await request.json());
    const result = await locations.updateBuilding(
      buildingIdSchema.parse((await context.params).id),
      input.areaId,
      input.name,
    );
    if (!result) throw Object.assign(new Error("Building not found"), { status: 404 });
    return result;
  });
}
export async function DELETE(_request: Request, context: Context) {
  return route(async () => {
    const result = await locations.archiveBuilding(
      buildingIdSchema.parse((await context.params).id),
    );
    if (!result) throw Object.assign(new Error("Building not found"), { status: 404 });
  }, 204);
}
