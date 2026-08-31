import { NextRequest } from "next/server";
import * as locations from "@/server/models/location.model";
import { buildingSchema } from "@/server/validators/location.schema";
import { route } from "@/server/http";
export async function POST(request: NextRequest) {
  return route(async () => {
    const input = buildingSchema.parse(await request.json());
    return locations.createBuilding(input.areaId, input.name);
  }, 201);
}
