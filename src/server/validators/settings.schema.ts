import { z } from "zod";

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(30),
  email: z.email(),
  trn: z.string().trim().max(30),
  address: z.string().trim().min(3).max(500),
  invoicePrefix: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Z0-9-]+$/),
  vatRate: z.coerce.number().min(0).max(100),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
