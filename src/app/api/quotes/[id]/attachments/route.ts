import type { NextRequest } from "next/server";

import { listAttachmentsController, uploadAttachmentController } from "@/controllers/attachment.controller";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]/attachments">) {
  const { id } = await ctx.params;
  return uploadAttachmentController(request, id);
}

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/quotes/[id]/attachments">) {
  const { id } = await ctx.params;
  return listAttachmentsController(id);
}
