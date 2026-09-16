import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { AppError, handleError, NotFoundError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { createUserSchema, updateUserSchema } from "@/validations/user.validation";

const USER_LIST_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function List() {
  try {
    await requireAuth();

    const users = await prisma.user.findMany({
      where: { trashed: false },
      select: USER_LIST_FIELDS,
      orderBy: { createdAt: "desc" },
    });

    return sendSuccessResponse(users, "Users fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "users");
  }
}

export async function Store(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, createUserSchema);
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash,
      },
      select: USER_LIST_FIELDS,
    });

    return sendSuccessResponse(user, "User created successfully", RESPONSE_CODE.CREATED, HTTP_STATUS.CREATED);
  } catch (exception) {
    return handleError(exception, "users");
  }
}

export async function Update(request: NextRequest, userId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    const input = await parseJsonBody(request, updateUserSchema);

    const existing = await prisma.user.findFirst({ where: { id: userId, trashed: false } });
    if (!existing) throw new NotFoundError("User not found");

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
      },
      select: USER_LIST_FIELDS,
    });

    return sendSuccessResponse(user, "User updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "users");
  }
}

export async function StatusChange(userId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    if (userId === session.user.id) {
      throw new AppError("You cannot change your own status", HTTP_STATUS.BAD_REQUEST, RESPONSE_CODE.VALIDATION_ERROR);
    }

    const existing = await prisma.user.findFirst({ where: { id: userId, trashed: false } });
    if (!existing) throw new NotFoundError("User not found");

    const user = await prisma.user.update({
      where: { id: userId },
      data: { active: !existing.active },
      select: USER_LIST_FIELDS,
    });

    return sendSuccessResponse(user, "User status updated successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "users");
  }
}

export async function Delete(userId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, ["admin"]);

    if (userId === session.user.id) {
      throw new AppError("You cannot delete your own account", HTTP_STATUS.BAD_REQUEST, RESPONSE_CODE.VALIDATION_ERROR);
    }

    const existing = await prisma.user.findFirst({ where: { id: userId, trashed: false } });
    if (!existing) throw new NotFoundError("User not found");

    await prisma.user.update({
      where: { id: userId },
      data: { active: false, trashed: true },
    });

    return sendSuccessResponse(null, "User deleted successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "users");
  }
}
