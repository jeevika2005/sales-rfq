import type { NextRequest } from "next/server";

import { Store } from "@/controllers/role-permission.controller";

export async function POST(request: NextRequest) {
  return Store(request);
}
