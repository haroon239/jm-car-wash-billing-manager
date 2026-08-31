import { NextRequest } from "next/server";
import * as locations from "@/server/models/location.model";
import { areaSchema } from "@/server/validators/location.schema";
import { route } from "@/server/http";
export async function POST(request: NextRequest) {
  return route(async () => {
    const input = areaSchema.parse(await request.json());
    return locations.createArea(input.propertyId, input.name);
  }, 201);
}
