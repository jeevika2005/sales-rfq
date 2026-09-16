export const ALLOWED_PERMISSIONS = [
  "List",
  "Add",
  "Edit",
  "View",
  "Delete",
  "StatusChange",
  "Approve",
] as const;

export type PermissionAction = (typeof ALLOWED_PERMISSIONS)[number];

export type PermissionFlags = Record<PermissionAction, boolean>;
