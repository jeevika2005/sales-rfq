import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional(),
  companyCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional(),
  companyCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  archived: z.boolean().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
