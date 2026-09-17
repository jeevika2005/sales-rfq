import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { NextRequest } from "next/server";

import { HTTP_STATUS, PRISMA_ERROR_CODE, RESPONSE_CODE, type ResponseCode } from "@/constants";
import { Prisma } from "@/generated/prisma/client";

// ---- errors ----

export class AppError extends Error {
  readonly statusCode: number;
  readonly responseCode: ResponseCode;

  constructor(message: string, statusCode: number, responseCode: ResponseCode) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.responseCode = responseCode;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, HTTP_STATUS.BAD_REQUEST, RESPONSE_CODE.VALIDATION_ERROR);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, HTTP_STATUS.UNAUTHORIZED, RESPONSE_CODE.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(message, HTTP_STATUS.FORBIDDEN, RESPONSE_CODE.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, HTTP_STATUS.NOT_FOUND, RESPONSE_CODE.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Already exists") {
    super(message, HTTP_STATUS.CONFLICT, RESPONSE_CODE.CONFLICT);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests — try again shortly") {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, RESPONSE_CODE.RATE_LIMITED);
  }
}

export class ExtractionError extends AppError {
  constructor(message = "No valve specifications could be extracted") {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, RESPONSE_CODE.EXTRACTION_FAILED);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "File is too large") {
    super(message, HTTP_STATUS.PAYLOAD_TOO_LARGE, RESPONSE_CODE.PAYLOAD_TOO_LARGE);
  }
}

// ---- logger ----

export const logger = {
  info(scope: string, message: string, meta?: unknown) {
    console.log(`[${scope}] ${message}`, meta ?? "");
  },
  warn(scope: string, message: string, meta?: unknown) {
    console.warn(`[${scope}] ${message}`, meta ?? "");
  },
  error(scope: string, message: string, meta?: unknown) {
    console.error(`[${scope}] ${message}`, meta ?? "");
  },
};

// ---- request body parsing ----

export async function parseJsonBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  return schema.parseAsync(body);
}

// ---- response envelope ----

export function sendSuccessResponse<T>(
  data: T,
  message: string,
  responseCode: ResponseCode,
  statusCode: number,
) {
  return NextResponse.json(
    { success: true, message, response_code: responseCode, data },
    { status: statusCode },
  );
}

export function sendErrorResponse(message: string, responseCode: ResponseCode, statusCode: number) {
  return NextResponse.json(
    { success: false, message, response_code: responseCode },
    { status: statusCode },
  );
}

// ---- error handler ----

export function handleError(exception: unknown, scope = "api") {
  if (exception instanceof AppError) {
    return sendErrorResponse(exception.message, exception.responseCode, exception.statusCode);
  }

  if (exception instanceof ZodError) {
    const firstIssue = exception.issues[0];
    const path = firstIssue?.path.join(".");
    const message = firstIssue ? (path ? `${path}: ${firstIssue.message}` : firstIssue.message) : "Validation failed";
    return sendErrorResponse(message, RESPONSE_CODE.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === PRISMA_ERROR_CODE.UNIQUE_CONSTRAINT_VIOLATION) {
      return sendErrorResponse(
        "A record with these details already exists",
        RESPONSE_CODE.CONFLICT,
        HTTP_STATUS.CONFLICT,
      );
    }
    if (exception.code === PRISMA_ERROR_CODE.RECORD_NOT_FOUND) {
      return sendErrorResponse("Record not found", RESPONSE_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }
  }

  logger.error(scope, "Unhandled error", exception);
  return sendErrorResponse(
    "Server error",
    RESPONSE_CODE.SERVER_ERROR,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
  );
}

