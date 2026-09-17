import type { NextRequest } from "next/server";

import { parseQuoteController } from "@/controllers/quote-parse.controller";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return parseQuoteController(request);
}
