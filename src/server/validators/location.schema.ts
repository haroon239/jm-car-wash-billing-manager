import { z } from "zod";

export const areaSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120),
});

export const buildingSchema = z.object({
  areaId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120),
});

export const buildingIdSchema = z.coerce.number().int().positive();
