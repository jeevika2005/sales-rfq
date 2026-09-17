import type { NextRequest } from "next/server";

import { createQuoteController, listQuotesController } from "@/controllers/quote.controller";

export async function GET() {
  return listQuotesController();
}

export async function POST(request: NextRequest) {
  return createQuoteController(request);
}
