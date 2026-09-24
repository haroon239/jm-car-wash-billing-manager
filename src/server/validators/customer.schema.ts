import { z } from "zod";

export const customerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\d{7,15}$/),
    email: z.email().optional().or(z.literal("")),
    plateNumber: z.string().trim().min(2).max(40),
    buildingNo: z.string().trim().max(50).optional().default(""),
    flatNo: z.string().trim().max(50).optional().default(""),
    roomNo: z.string().trim().max(50).optional().default(""),
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
    contractEndDate: z.iso.date().nullable(),
    washesPerCycle: z.coerce.number().int().positive().max(1000).nullable(),
    agreedPrice: z.coerce.number().nonnegative().max(9999999),
    billingType: z.enum(["monthly", "weekly", "one_time", "manual"]),
    autoInvoice: z.boolean(),
    nextInvoiceDate: z.iso.date().nullable(),
  })
  .superRefine((value, context) => {
    const invalid = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.contractEndDate && value.contractEndDate < value.planStartDate)
      invalid("contractEndDate", "Contract end date cannot be before the plan start date.");
    if (value.nextInvoiceDate && value.nextInvoiceDate < value.planStartDate)
      invalid("nextInvoiceDate", "Next billing date cannot be before the plan start date.");
    if (value.autoInvoice && value.billingType === "manual")
      invalid("autoInvoice", "Automatic billing must be switched off for manual billing.");
    if (value.autoInvoice && !value.nextInvoiceDate)
      invalid("nextInvoiceDate", "Select a next billing date when automatic billing is enabled.");
    if (Math.abs(value.agreedPrice * 100 - Math.round(value.agreedPrice * 100)) > 0.000001)
      invalid("agreedPrice", "Enter an agreed price with at most two decimal places.");
    const plates = value.vehicles.map((vehicle) =>
      vehicle.plateNumber.toUpperCase().replace(/\s+/g, ""),
    );
    if (new Set(plates).size !== plates.length)
      invalid(
        "vehicles",
        "The same vehicle number is entered more than once. Remove the duplicate vehicle.",
      );
  });

export const idSchema = z.coerce.number().int().positive();

export const customerDeletionSchema = z.object({
  confirmationName: z.string().trim().min(1).max(120),
});
export type CustomerInput = z.infer<typeof customerSchema>;
