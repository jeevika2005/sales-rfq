import { exportQuoteController } from "@/controllers/quote.controller";

export async function GET(_request: Request, ctx: RouteContext<"/api/quotes/[id]/export">) {
  const { id } = await ctx.params;
  return exportQuoteController(id);
}
