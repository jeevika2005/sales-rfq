import { z } from "zod";

import { UserRole } from "@/generated/prisma/enums";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(1, "Full name is required"),
  role: z.enum(UserRole),
});

export const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1, "Full name is required"),
  role: z.enum(UserRole),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
