import type { NextRequest } from "next/server";

import { Delete, Update } from "@/controllers/user.controller";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return Update(request, id);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return Delete(id);
}
