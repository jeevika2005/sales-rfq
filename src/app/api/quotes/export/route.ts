import type { NextRequest } from "next/server";

import { exportValveItemsController } from "@/controllers/quote.controller";

export async function POST(request: NextRequest) {
  return exportValveItemsController(request);
}
