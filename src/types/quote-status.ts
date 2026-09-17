import { UserRole } from "@/generated/prisma/enums";
import { ForbiddenError, ValidationError } from "@/lib/response";

export const QUOTE_STATUSES = [
  "draft",
  "pending",
  "quoted",
  "approved",
  "won",
  "lost",
  "rejected",
  "completed",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

// §6.2 — enforced in the service layer, not the client.
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["pending", "quoted", "rejected"],
  pending: ["quoted", "rejected", "draft"],
  quoted: ["approved", "lost", "rejected", "pending"],
  approved: ["won", "lost", "rejected", "quoted"],
  won: ["completed"],
  lost: ["quoted"],
  rejected: ["draft"],
  completed: ["won"],
};

// Transitions restricted to elevated roles (§6.2: "(admin/manager only)").
const ELEVATED_ONLY: Record<string, readonly UserRole[]> = {
  "lost->quoted": [UserRole.admin, UserRole.manager],
  "rejected->draft": [UserRole.admin, UserRole.manager],
  "completed->won": [UserRole.admin],
};

export function assertValidStatusTransition(from: string, to: string, role: UserRole): void {
  if (from === to) return;

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed?.includes(to)) {
    throw new ValidationError(`Invalid status transition: ${from} → ${to}`);
  }

  const restriction = ELEVATED_ONLY[`${from}->${to}`];
  if (restriction && !restriction.includes(role)) {
    throw new ForbiddenError(
      `Only ${restriction.join("/")} can move a quote from ${from} to ${to}`,
    );
  }
}
