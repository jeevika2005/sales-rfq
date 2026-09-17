import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth, requireRole } from "@/lib/guards";
import { handleError, parseJsonBody, sendSuccessResponse, ValidationError } from "@/lib/response";
import { buildValveItemsWorkbook, toExportableItems } from "@/services/quote-export.service";
import {
  createQuote,
  deleteQuote,
  getQuoteAuditLogs,
  getQuoteForSession,
  getQuoteVersionDetail,
  getQuoteVersions,
  listQuotesForSession,
  restoreQuoteVersion,
  updateQuote,
} from "@/services/quote.service";
import { createQuoteSchema, exportValveItemsSchema, updateQuoteSchema } from "@/validations/quote.validation";

const WRITE_ROLES = [UserRole.admin, UserRole.manager, UserRole.sales] as const;

export async function listQuotesController() {
  try {
    // Scope (own vs all) is enforced inside listQuotesForSession, same as
    // the detail endpoint — every role can call this, viewers included.
    const session = await requireAuth();
    const quotes = await listQuotesForSession(session);

    return sendSuccessResponse(quotes, "Quotes fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function exportValveItemsController(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const input = await parseJsonBody(request, exportValveItemsSchema);
    const buffer = await buildValveItemsWorkbook(input.valveItems);

    return new Response(new Uint8Array(buffer), {
      status: HTTP_STATUS.OK,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="quote-review.xlsx"',
      },
    });
  } catch (exception) {
    return handleError(exception, "quotes/export");
  }
}

export async function createQuoteController(request: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const input = await parseJsonBody(request, createQuoteSchema);
    const quote = await createQuote(input, session.user.id);

    return sendSuccessResponse(quote, "Quote created successfully", RESPONSE_CODE.CREATED, HTTP_STATUS.CREATED);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function exportQuoteController(quoteId: string) {
  try {
    const session = await requireAuth();
    const quote = await getQuoteForSession(quoteId, session);

    const buffer = await buildValveItemsWorkbook(toExportableItems(quote.items));

    return new Response(new Uint8Array(buffer), {
      status: HTTP_STATUS.OK,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.xlsx"`,
      },
    });
  } catch (exception) {
    return handleError(exception, "quotes/export");
  }
}

export async function getQuoteController(quoteId: string) {
  try {
    // Read is available to every role (including viewer) — data scope
    // (own vs all) is enforced inside getQuoteForSession, not here.
    const session = await requireAuth();
    const quote = await getQuoteForSession(quoteId, session);

    return sendSuccessResponse(quote, "Quote fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function updateQuoteController(request: NextRequest, quoteId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const input = await parseJsonBody(request, updateQuoteSchema);
    const { quote, versionBumped } = await updateQuote(quoteId, input, session);

    return sendSuccessResponse(
      quote,
      versionBumped ? "Quote updated successfully" : "No changes",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function deleteQuoteController(quoteId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    await getQuoteForSession(quoteId, session); // scope check before delete
    await deleteQuote(quoteId, session);

    return sendSuccessResponse(null, "Quote deleted successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

function parseVersionParam(raw: string): number {
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) {
    throw new ValidationError("Invalid version number");
  }
  return version;
}

export async function listQuoteVersionsController(quoteId: string) {
  try {
    const session = await requireAuth();
    const versions = await getQuoteVersions(quoteId, session);

    return sendSuccessResponse(versions, "Versions fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function getQuoteVersionController(quoteId: string, versionParam: string) {
  try {
    const session = await requireAuth();
    const version = parseVersionParam(versionParam);
    const versionRow = await getQuoteVersionDetail(quoteId, version, session);

    return sendSuccessResponse(versionRow, "Version fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function getQuoteAuditLogsController(quoteId: string) {
  try {
    const session = await requireAuth();
    const logs = await getQuoteAuditLogs(quoteId, session);

    return sendSuccessResponse(logs, "Activity fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}

export async function restoreQuoteVersionController(quoteId: string, versionParam: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);

    const version = parseVersionParam(versionParam);
    const { quote, versionBumped } = await restoreQuoteVersion(quoteId, version, session);

    return sendSuccessResponse(
      quote,
      versionBumped ? `Restored from version ${version}` : "No changes — already matches this version",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "quotes");
  }
}
