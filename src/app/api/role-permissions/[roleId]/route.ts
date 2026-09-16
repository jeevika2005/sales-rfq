import type { NextRequest } from "next/server";

import { List } from "@/controllers/role-permission.controller";

type Params = { params: Promise<{ roleId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { roleId } = await params;
  return List(roleId);
}
