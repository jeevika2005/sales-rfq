import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth, requireRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { handleError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { createCustomerSchema, updateCustomerSchema } from "@/validations/customer.validation";

const WRITE_ROLES = [UserRole.admin, UserRole.manager, UserRole.sales] as const;

export async function listCustomersController(request: NextRequest) {
  try {
    await requireAuth();

    const q = request.nextUrl.searchParams.get("q")?.trim();
    const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

    const customers = await prisma.customer.findMany({
      where: {
        ...(includeArchived ? {} : { archived: false }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccessResponse(
      customers,
      "Customers fetched successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "customers");
  }
}

export async function createCustomerController(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const data = await parseJsonBody(request, createCustomerSchema);

    const customer = await prisma.customer.create({
      data: { ...data, createdBy: session.user.id },
    });

    return sendSuccessResponse(
      customer,
      "Customer created successfully",
      RESPONSE_CODE.CREATED,
      HTTP_STATUS.CREATED,
    );
  } catch (exception) {
    return handleError(exception, "customers");
  }
}

export async function updateCustomerController(request: NextRequest, customerId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const data = await parseJsonBody(request, updateCustomerSchema);

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
    });

    return sendSuccessResponse(
      customer,
      "Customer updated successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "customers");
  }
}
