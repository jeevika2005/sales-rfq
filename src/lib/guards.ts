import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/response";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * requireAuth / requireRole — the "requireAuth → requireRole" steps of the
 * pipeline (rateLimit → requireAuth → requireRole → parseJsonBody →
 * service → JSON). Both throw, so a controller just calls them and lets
 * the route's catch block + handleError() turn the throw into a 401/403.
 */
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
