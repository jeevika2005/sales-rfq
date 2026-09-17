import { listQuoteVersionsController } from "@/controllers/quote.controller";

export async function GET(_request: Request, ctx: RouteContext<"/api/quotes/[id]/versions">) {
  const { id } = await ctx.params;
  return listQuoteVersionsController(id);
}
