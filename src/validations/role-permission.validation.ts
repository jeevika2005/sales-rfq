import { z } from "zod";

export const assignRolePermissionSchema = z.object({
  roleId: z.uuid(),
  menuKey: z.string().trim().min(1, "Menu key is required"),
  permissions: z.object({
    List: z.boolean().optional(),
    Add: z.boolean().optional(),
    Edit: z.boolean().optional(),
    View: z.boolean().optional(),
    Delete: z.boolean().optional(),
    StatusChange: z.boolean().optional(),
    Approve: z.boolean().optional(),
  }),
});

export type AssignRolePermissionInput = z.infer<typeof assignRolePermissionSchema>;
