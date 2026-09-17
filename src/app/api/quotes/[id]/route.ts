import type { NextRequest } from "next/server";

import { deleteQuoteController, getQuoteController, updateQuoteController } from "@/controllers/quote.controller";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  return getQuoteController(id);
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  return updateQuoteController(request, id);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  return deleteQuoteController(id);
}
