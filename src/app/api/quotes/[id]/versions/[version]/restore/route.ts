import { restoreQuoteVersionController } from "@/controllers/quote.controller";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/quotes/[id]/versions/[version]/restore">,
) {
  const { id, version } = await ctx.params;
  return restoreQuoteVersionController(id, version);
}
