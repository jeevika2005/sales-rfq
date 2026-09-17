import { getQuoteAuditLogsController } from "@/controllers/quote.controller";

export async function GET(_request: Request, ctx: RouteContext<"/api/quotes/[id]/logs">) {
  const { id } = await ctx.params;
  return getQuoteAuditLogsController(id);
}
