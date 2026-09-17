import { z } from "zod";

import { QUOTE_STATUSES } from "@/types/quote-status";

export const valveItemSchema = z.object({
  id: z.string(),
  valveType: z.string(),
  quantity: z.number(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export const createQuoteSchema = z.object({
  // Required and strict: every quote must reference a real Customer row.
  // The snapshot (name/email/phone) is taken FROM that record server-side
  // (see quote.service.ts) — not accepted from the client, so a caller
  // can't send a customerId for one customer but a different name.
  customerId: z.string().uuid("A valid customer is required"),
  deliveryDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  valveItems: z.array(valveItemSchema).min(1, "At least one valve item is required"),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// FR4.7 — everything optional (true PATCH semantics): the edit screen
// sends the full form, but the API itself doesn't require every field on
// every call. Fields left out simply keep their current value.
export const updateQuoteSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
  deliveryDate: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  currency: z.string().trim().optional(),
  valveItems: z.array(valveItemSchema).min(1, "At least one valve item is required").optional(),
  changeNotes: z.string().trim().optional(),
});

export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const exportValveItemsSchema = z.object({
  valveItems: z.array(valveItemSchema).min(1, "At least one valve item is required"),
});
