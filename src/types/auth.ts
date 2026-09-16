import type { UserRole } from "@/generated/prisma/enums";


export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};
