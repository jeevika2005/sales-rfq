import type { NextRequest } from "next/server";

import { ALLOWED_PERMISSIONS, type PermissionFlags } from "@/constants/permissions";
import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { handleError, NotFoundError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { createLeftMenuSchema, updateLeftMenuSchema } from "@/validations/left-menu.validation";

export async function List() {
  try {
    await requireAuth();

    const menus = await prisma.leftMenu.findMany({
      where: { trashed: false },
      orderBy: { createdAt: "desc" },
      include: { parent: { select: { name: true } } },
    });

    return sendSuccessResponse(menus, "Left menu fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function Dropdown() {
  try {
    await requireAuth();

    const menus = await prisma.leftMenu.findMany({
      where: { active: true, trashed: false },
      select: { id: true, menuKey: true, name: true, isParent: true, parentId: true },
      orderBy: { name: "asc" },
    });

    return sendSuccessResponse(menus, "Left menu fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function Store(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, createLeftMenuSchema);

    const menu = await prisma.leftMenu.create({
      data: { ...input, createdBy: session.user.id },
    });

    return sendSuccessResponse(menu, "Menu created successfully", RESPONSE_CODE.CREATED, HTTP_STATUS.CREATED);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function Update(request: NextRequest, menuId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, updateLeftMenuSchema);

    const existing = await prisma.leftMenu.findFirst({ where: { id: menuId, trashed: false } });
    if (!existing) throw new NotFoundError("Menu not found");

    const menu = await prisma.leftMenu.update({
      where: { id: menuId },
      data: { ...input, updatedBy: session.user.id },
    });

    return sendSuccessResponse(menu, "Menu updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function StatusChange(menuId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const existing = await prisma.leftMenu.findFirst({ where: { id: menuId, trashed: false } });
    if (!existing) throw new NotFoundError("Menu not found");

    const menu = await prisma.$transaction(async (tx) => {
      const updated = await tx.leftMenu.update({
        where: { id: menuId },
        data: { active: !existing.active, updatedBy: session.user.id },
      });

      if (updated.isParent && !updated.active) {
        await tx.leftMenu.updateMany({
          where: { parentId: menuId },
          data: { active: false, updatedBy: session.user.id },
        });
      }

      return updated;
    });

    return sendSuccessResponse(menu, "Menu status updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function Delete(menuId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const existing = await prisma.leftMenu.findFirst({ where: { id: menuId, trashed: false } });
    if (!existing) throw new NotFoundError("Menu not found");

    await prisma.$transaction(async (tx) => {
      await tx.leftMenu.update({
        where: { id: menuId },
        data: { active: false, trashed: true, updatedBy: session.user.id },
      });

      if (existing.isParent) {
        await tx.leftMenu.updateMany({
          where: { parentId: menuId },
          data: { active: false, trashed: true, updatedBy: session.user.id },
        });
      }
    });

    return sendSuccessResponse(null, "Menu deleted successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}

export async function RoleBasedMenu(roleId: string) {
  try {
    await requireAuth();

    const menus = await prisma.leftMenu.findMany({ where: { active: true, trashed: false } });

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId, active: true, trashed: false },
    });

    const permissionsByMenuKey = new Map(rolePermissions.map((rp) => [rp.menuKey, rp.permissions as PermissionFlags]));

    const hasAccess = (menuKey: string) => {
      const flags = permissionsByMenuKey.get(menuKey);
      if (!flags) return false;
      return ALLOWED_PERMISSIONS.some((action) => flags[action] === true);
    };

    const parentIdsWithAccess = new Set(
      menus
        .filter((menu) => !menu.isParent && menu.parentId && hasAccess(menu.menuKey))
        .map((menu) => menu.parentId as string),
    );

    const visibleMenus = menus.filter((menu) => {
      if (!menu.isParent && !menu.parentId) return hasAccess(menu.menuKey);
      if (menu.isParent) return parentIdsWithAccess.has(menu.id);
      return hasAccess(menu.menuKey);
    });

    return sendSuccessResponse(visibleMenus, "Role based menu fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "left-menu");
  }
}
