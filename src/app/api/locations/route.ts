import * as locations from "@/server/models/location.model";
import { route } from "@/server/http";
export function GET() {
  return route(() => locations.findLocations());
}
