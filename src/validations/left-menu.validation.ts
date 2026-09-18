import { z } from "zod";

export const createLeftMenuSchema = z.object({
  menuKey: z.string().trim().min(1, "Menu key is required"),
  name: z.string().trim().min(1, "Menu name is required"),
  icon: z.string().trim().optional(),
  url: z.string().trim().optional(),
  isParent: z.boolean().default(false),
  parentId: z.uuid().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateLeftMenuSchema = createLeftMenuSchema;

export type CreateLeftMenuInput = z.infer<typeof createLeftMenuSchema>;
export type UpdateLeftMenuInput = z.infer<typeof updateLeftMenuSchema>;
