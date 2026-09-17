import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth, requireRole } from "@/lib/guards";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  handleError,
  parseJsonBody,
  PayloadTooLargeError,
  RateLimitedError,
  sendSuccessResponse,
  ValidationError,
} from "@/lib/response";
import {
  getBase64ByteSize,
  parseValveItemsFromExcel,
  parseValveItemsFromPdf,
  parseValveItemsFromText,
} from "@/services/quote-parse.service";
import { parseRequestSchema } from "@/validations/quote-parse.validation";

const WRITE_ROLES = [UserRole.admin, UserRole.manager, UserRole.sales] as const;

// FR-3.13 / FR-9.2: parse is write-only and strictly rate-limited —
// 5 requests per 5 minutes per user (small in-memory budget; see
// lib/rate-limit.ts for why this doesn't scale past one instance yet).
const PARSE_RATE_LIMIT = 5;
const PARSE_RATE_WINDOW_MS = 5 * 60 * 1000;

// FR-3.3: server rejects any uploaded file over 25MB.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// §11.4: stricter, PDF-specific limit for what actually gets sent to Gemini.
const MAX_PDF_BYTES_FOR_GEMINI = Number(
  process.env.GEMINI_SALES_PDF_DOCUMENT_MAX_BYTES ?? 10_000_000,
);

export async function parseQuoteController(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    if (!checkRateLimit(`parse:${session.user.id}`, PARSE_RATE_LIMIT, PARSE_RATE_WINDOW_MS)) {
      throw new RateLimitedError("Parse rate limit reached — try again in a few minutes");
    }

    const input = await parseJsonBody(request, parseRequestSchema);

    let valveItems;

    if (input.mode === "text") {
      valveItems = await parseValveItemsFromText(input.text!);
    } else if (input.mode === "pdf") {
      const byteSize = getBase64ByteSize(input.base64Data!);
      if (byteSize > MAX_FILE_BYTES) {
        throw new PayloadTooLargeError("File exceeds the 25MB upload limit");
      }
      if (byteSize > MAX_PDF_BYTES_FOR_GEMINI) {
        throw new PayloadTooLargeError(
          `PDF exceeds the ${Math.round(MAX_PDF_BYTES_FOR_GEMINI / 1_000_000)}MB limit for AI parsing`,
        );
      }
      valveItems = await parseValveItemsFromPdf(input.base64Data!);
    } else if (input.mode === "excel") {
      const byteSize = getBase64ByteSize(input.base64Data!);
      if (byteSize > MAX_FILE_BYTES) {
        throw new PayloadTooLargeError("File exceeds the 25MB upload limit");
      }
      valveItems = await parseValveItemsFromExcel(input.base64Data!);
    } else {
      throw new ValidationError(`mode "${input.mode}" is not implemented yet`);
    }

    return sendSuccessResponse(
      { valveItems },
      "Parsed successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "quotes/parse");
  }
}
