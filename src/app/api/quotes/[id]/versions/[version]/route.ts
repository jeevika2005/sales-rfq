import { getQuoteVersionController } from "@/controllers/quote.controller";

export async function GET(_request: Request, ctx: RouteContext<"/api/quotes/[id]/versions/[version]">) {
  const { id, version } = await ctx.params;
  return getQuoteVersionController(id, version);
}
