import type { NextRequest } from "next/server";

import { deleteAttachmentController, downloadAttachmentController } from "@/controllers/attachment.controller";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/quotes/[id]/attachments/[attachmentId]">,
) {
  const { id, attachmentId } = await ctx.params;
  return downloadAttachmentController(id, attachmentId);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/quotes/[id]/attachments/[attachmentId]">,
) {
  const { id, attachmentId } = await ctx.params;
  return deleteAttachmentController(id, attachmentId);
}
