import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\d{7,15}$/),
  email: z.email().optional().or(z.literal("")),
  plateNumber: z.string().trim().min(2).max(40),
  buildingNo: z.string().trim().max(50).optional().default(""),
  flatNo: z.string().trim().max(50).optional().default(""),
  parkingNo: z.string().trim().max(50).optional().default(""),
  areaId: z.coerce.number().int().positive(),
  buildingId: z.coerce.number().int().positive(),
  vehicles: z
    .array(
      z.object({
        plateNumber: z.string().trim().min(2).max(40),
        makeModel: z.string().trim().max(120).optional().default(""),
        parkingNumber: z.string().trim().max(50).optional().default(""),
      }),
    )
    .min(1)
    .max(20),
  planId: z.coerce.number().int().positive(),
  planStartDate: z.iso.date(),
  agreedPrice: z.coerce.number().nonnegative().max(9999999),
  billingType: z.enum(["monthly", "weekly", "one_time", "manual"]),
  autoInvoice: z.boolean(),
  nextInvoiceDate: z.iso.date().nullable(),
});

export const idSchema = z.coerce.number().int().positive();
export type CustomerInput = z.infer<typeof customerSchema>;
