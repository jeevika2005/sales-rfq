import { z } from "zod";

import { DataScope } from "@/generated/prisma/enums";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required"),
  dataScope: z.enum(DataScope),
});

export const updateRoleSchema = createRoleSchema;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
