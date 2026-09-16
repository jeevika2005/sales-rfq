import type { NextRequest } from "next/server";

import { List, Store } from "@/controllers/left-menu.controller";

export async function GET() {
  return List();
}

export async function POST(request: NextRequest) {
  return Store(request);
}
