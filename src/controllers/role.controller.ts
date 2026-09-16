import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { handleError, NotFoundError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { createRoleSchema, updateRoleSchema } from "@/validations/role.validation";

export async function List() {
  try {
    await requireAuth();

    const roles = await prisma.role.findMany({
      where: { trashed: false },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccessResponse(roles, "Roles fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "roles");
  }
}

export async function Store(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, createRoleSchema);

    const role = await prisma.role.create({
      data: { ...input, createdBy: session.user.id },
    });

    return sendSuccessResponse(
      role,
      "Role created successfully",
      RESPONSE_CODE.CREATED,
      HTTP_STATUS.CREATED
    );
  } catch (exception) {
    return handleError(exception, "roles");
  }
}

export async function Update(request: NextRequest, roleId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, updateRoleSchema);

    const existing = await prisma.role.findFirst({ where: { id: roleId, trashed: false } });
    if (!existing) throw new NotFoundError("Role not found");

    const role = await prisma.role.update({
      where: { id: roleId },
      data: { ...input, updatedBy: session.user.id },
    });

    return sendSuccessResponse(role, "Role updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "roles");
  }
}

export async function StatusChange(roleId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const existing = await prisma.role.findFirst({ where: { id: roleId, trashed: false } });
    if (!existing) throw new NotFoundError("Role not found");

    const role = await prisma.role.update({
      where: { id: roleId },
      data: { active: !existing.active, updatedBy: session.user.id },
    });

    return sendSuccessResponse(role, "Role status updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "roles");
  }
}

export async function Delete(roleId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const existing = await prisma.role.findFirst({ where: { id: roleId, trashed: false } });
    if (!existing) throw new NotFoundError("Role not found");

    await prisma.role.update({
      where: { id: roleId },
      data: { trashed: true, active: false, updatedBy: session.user.id },
    });

    return sendSuccessResponse(null, "Role deleted successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "roles");
  }
}
