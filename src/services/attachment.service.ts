import type { Session } from "next-auth";

import type { AttachmentKind } from "@/generated/prisma/enums";
import { buildStorageKey, deleteAttachmentFile, readAttachmentFile, saveAttachmentFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/response";

type CreateAttachmentInput = {
  quoteId: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  userId: string;
};

export async function createAttachment(input: CreateAttachmentInput) {
  const id = crypto.randomUUID();
  const storageKey = buildStorageKey(id, input.fileName);

  await saveAttachmentFile(storageKey, input.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          id,
          quoteId: input.quoteId,
          kind: input.kind,
          fileName: input.fileName,
          mimeType: input.mimeType,
          byteSize: input.buffer.byteLength,
          storageKey,
          createdBy: input.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          action: "attachment.upload",
          entityType: "Attachment",
          entityId: attachment.id,
          metadata: { quoteId: input.quoteId, fileName: input.fileName, kind: input.kind },
        },
      });

      return attachment;
    });
  } catch (exception) {
    // DB insert failed after the file was already written — clean up the
    // orphan so it doesn't linger on disk forever.
    await deleteAttachmentFile(storageKey);
    throw exception;
  }
}

export async function listAttachments(quoteId: string) {
  return prisma.attachment.findMany({ where: { quoteId }, orderBy: { createdAt: "desc" } });
}

export async function getAttachmentForQuote(quoteId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.quoteId !== quoteId) {
    throw new NotFoundError("Attachment not found");
  }
  return attachment;
}

export async function readAttachmentContent(storageKey: string) {
  return readAttachmentFile(storageKey);
}

export async function deleteAttachment(quoteId: string, attachmentId: string, session: Session) {
  const attachment = await getAttachmentForQuote(quoteId, attachmentId);

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "attachment.delete",
        entityType: "Attachment",
        entityId: attachment.id,
        metadata: { quoteId, fileName: attachment.fileName, kind: attachment.kind },
      },
    }),
    prisma.attachment.delete({ where: { id: attachmentId } }),
  ]);

  await deleteAttachmentFile(attachment.storageKey);
}
