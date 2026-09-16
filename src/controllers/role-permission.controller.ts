import type { NextRequest } from "next/server";

import { ALLOWED_PERMISSIONS, type PermissionFlags } from "@/constants/permissions";
import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { handleError, NotFoundError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { assignRolePermissionSchema } from "@/validations/role-permission.validation";

export async function Store(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const { roleId, menuKey, permissions } = await parseJsonBody(request, assignRolePermissionSchema);

    const role = await prisma.role.findFirst({ where: { id: roleId, trashed: false } });
    if (!role) throw new NotFoundError("Role not found");

    const validatedPermissions = Object.fromEntries(
      ALLOWED_PERMISSIONS.map((action) => [action, Boolean(permissions[action])]),
    ) as PermissionFlags;

    const rolePermission = await prisma.rolePermission.upsert({
      where: { roleId_menuKey: { roleId, menuKey } },
      create: {
        roleId,
        menuKey,
        permissions: validatedPermissions,
        createdBy: session.user.id,
      },
      update: {
        permissions: validatedPermissions,
        updatedBy: session.user.id,
      },
    });

    return sendSuccessResponse(
      rolePermission,
      "Permissions assigned successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "role-permissions");
  }
}

export async function List(roleId: string) {
  try {
    await requireAuth();

    const role = await prisma.role.findFirst({ where: { id: roleId, trashed: false } });
    if (!role) throw new NotFoundError("Role not found");

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId, active: true, trashed: false },
    });

    const permissionsByMenuKey = Object.fromEntries(
      rolePermissions.map((rp) => [rp.menuKey, rp.permissions]),
    );

    return sendSuccessResponse(
      permissionsByMenuKey,
      "Permissions fetched successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "role-permissions");
  }
}
