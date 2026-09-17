// Shared between the quotes list and detail pages so status colors can't drift.
export const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "text-muted-foreground bg-muted",
  pending: "text-amber-600 bg-amber-500/10",
  quoted: "text-blue-600 bg-blue-500/10",
  approved: "text-indigo-600 bg-indigo-500/10",
  won: "text-emerald-600 bg-emerald-500/10",
  lost: "text-destructive bg-destructive/10",
  rejected: "text-destructive bg-destructive/10",
  completed: "text-emerald-600 bg-emerald-500/10",
};

// The "happy path" order shown in the status stepper. lost/rejected are
// side branches, not steps on this line, so they're deliberately excluded.
export const QUOTE_STATUS_PIPELINE = ["draft", "pending", "quoted", "approved", "won", "completed"] as const;

// UI-only mirror of §6.2's transition matrix (src/types/quote-status.ts) —
// duplicated here because that file pulls in server-only deps (Prisma,
// next/server) through lib/response.ts and can't be imported client-side.
// The server is the actual source of truth: it re-validates every PATCH
// regardless of what this suggests, so a stale/missing entry here only
// ever hides a button — it can never let an invalid transition through.
export const ALLOWED_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["pending", "quoted", "rejected"],
  pending: ["quoted", "rejected", "draft"],
  quoted: ["approved", "lost", "rejected", "pending"],
  approved: ["won", "lost", "rejected", "quoted"],
  won: ["completed"],
  lost: ["quoted"],
  rejected: ["draft"],
  completed: ["won"],
};

// Destination-keyed action labels/styles for the transition buttons.
export const QUOTE_STATUS_ACTIONS: Record<string, { label: string; variant: "primary" | "muted" | "destructive" }> = {
  draft: { label: "Reopen as Draft", variant: "muted" },
  pending: { label: "Move to Pending", variant: "muted" },
  quoted: { label: "Mark as Quoted", variant: "primary" },
  approved: { label: "Approve", variant: "primary" },
  won: { label: "Mark as Won", variant: "primary" },
  completed: { label: "Complete", variant: "primary" },
  lost: { label: "Mark as Lost", variant: "destructive" },
  rejected: { label: "Reject", variant: "destructive" },
};
