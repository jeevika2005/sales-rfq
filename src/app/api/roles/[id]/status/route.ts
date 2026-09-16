import type { NextRequest } from "next/server";

import { StatusChange } from "@/controllers/role.controller";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return StatusChange(id);
}
