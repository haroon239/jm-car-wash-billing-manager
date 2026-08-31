import { z } from "zod";

export const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.coerce.number().nonnegative().max(1_000_000),
  washesPerMonth: z.union([z.coerce.number().int().positive().max(1000), z.null()]),
});

export type PlanInput = z.infer<typeof planSchema>;
