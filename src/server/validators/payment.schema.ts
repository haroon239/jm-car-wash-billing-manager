import { z } from "zod";

export const paymentSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(9999999),
  method: z.enum(["cash", "card", "bank_transfer", "other"]),
  reference: z.string().trim().max(100).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
});

export const invoiceStatusSchema = z.object({
  status: z.enum(["pending", "sent", "paid", "overdue"]),
});

export const invoiceEditSchema = z
  .object({
    description: z.string().trim().min(2).max(200),
    customerNote: z.string().trim().max(500),
    total: z.coerce.number().positive().max(9999999),
    issueDate: z.iso.date(),
    dueDate: z.iso.date(),
    reason: z.string().trim().min(3).max(300),
    applyToFuture: z.boolean(),
  })
  .refine((value) => value.dueDate >= value.issueDate, {
    message: "Due date must be on or after the issue date",
    path: ["dueDate"],
  });
export type PaymentInput = z.infer<typeof paymentSchema>;
