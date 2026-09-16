import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/response";
import type { UserRole } from "@/generated/prisma/enums";


export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}

export function requireRole(
  role: UserRole,
  allowed: readonly UserRole[],
) {
  if (!allowed.includes(role)) {
    throw new ForbiddenError();
  }
}
