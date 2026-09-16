import type { NextRequest } from "next/server";

import { RoleBasedMenu } from "@/controllers/left-menu.controller";

type Params = { params: Promise<{ roleId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { roleId } = await params;
  return RoleBasedMenu(roleId);
}
