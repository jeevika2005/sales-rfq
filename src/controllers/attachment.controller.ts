import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth, requireRole } from "@/lib/guards";
import { handleError, PayloadTooLargeError, sendSuccessResponse, ValidationError } from "@/lib/response";
import {
  createAttachment,
  deleteAttachment,
  getAttachmentForQuote,
  listAttachments,
  readAttachmentContent,
} from "@/services/attachment.service";
import { getQuoteForSession } from "@/services/quote.service";
import { uploadAttachmentKindSchema } from "@/validations/attachment.validation";

const WRITE_ROLES = [UserRole.admin, UserRole.manager, UserRole.sales] as const;

// FR3.3 — same 25MB ceiling used for parse uploads.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function uploadAttachmentController(request: NextRequest, quoteId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);
    await getQuoteForSession(quoteId, session); // existence + scope check

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("A file is required");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeError("File exceeds the 25MB upload limit");
    }

    const kind = uploadAttachmentKindSchema.parse(formData.get("kind"));
    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await createAttachment({
      quoteId,
      kind,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      userId: session.user.id,
    });

    return sendSuccessResponse(
      attachment,
      "Attachment uploaded successfully",
      RESPONSE_CODE.CREATED,
      HTTP_STATUS.CREATED,
    );
  } catch (exception) {
    return handleError(exception, "quotes/attachments");
  }
}

export async function listAttachmentsController(quoteId: string) {
  try {
    const session = await requireAuth();
    await getQuoteForSession(quoteId, session);

    const attachments = await listAttachments(quoteId);

    return sendSuccessResponse(
      attachments,
      "Attachments fetched successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "quotes/attachments");
  }
}

export async function downloadAttachmentController(quoteId: string, attachmentId: string) {
  try {
    const session = await requireAuth();
    await getQuoteForSession(quoteId, session);

    const attachment = await getAttachmentForQuote(quoteId, attachmentId);
    const buffer = await readAttachmentContent(attachment.storageKey);

    return new Response(new Uint8Array(buffer), {
      status: HTTP_STATUS.OK,
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Content-Length": String(attachment.byteSize),
      },
    });
  } catch (exception) {
    return handleError(exception, "quotes/attachments");
  }
}

export async function deleteAttachmentController(quoteId: string, attachmentId: string) {
  try {
    const session = await requireAuth();
    requireRole(session.user.role, WRITE_ROLES);
    await getQuoteForSession(quoteId, session);

    await deleteAttachment(quoteId, attachmentId, session);

    return sendSuccessResponse(
      null,
      "Attachment deleted successfully",
      RESPONSE_CODE.SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "quotes/attachments");
  }
}
