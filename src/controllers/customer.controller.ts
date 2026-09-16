import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { handleError, parseJsonBody, sendSuccessResponse } from "@/lib/response";
import { createCustomerSchema } from "@/validations/customer.validation";

// SIMPLE pattern: Route → Controller → Prisma directly. A plain, unfiltered
// findMany has no business logic to justify a service layer.
export async function listCustomersController() {
  try {
    await requireAuth();

    const customers = await prisma.customer.findMany({
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

