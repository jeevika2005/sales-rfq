import { z } from "zod";

const MAX_TEXT_CHARS = 500_000;

export const parseRequestSchema = z
  .object({
    mode: z.enum(["text", "pdf", "excel"]),
    text: z.string().max(MAX_TEXT_CHARS, "Text is too long").optional(),
    fileName: z.string().optional(),
    base64Data: z.string().optional(),
  })
  .refine((data) => (data.mode === "text" ? !!data.text?.trim() : !!data.base64Data), {
    message: "text is required for mode \"text\"; base64Data is required otherwise",
  });

export type ParseRequestInput = z.infer<typeof parseRequestSchema>;

// Structural validation of Gemini's raw JSON output — catches a
// malformed/incomplete response before we trust it as SalesValveItem[].
export const valveItemsResponseSchema = z.object({
  valveItems: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).optional(),
      valveType: z.string(),
      quantity: z.number().optional(),
      unitPrice: z.number().optional(),
      totalPrice: z.number().optional(),
      attributes: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});
