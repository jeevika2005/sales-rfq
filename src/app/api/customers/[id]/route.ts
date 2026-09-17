import type { NextRequest } from "next/server";

import { updateCustomerController } from "@/controllers/customer.controller";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/customers/[id]">) {
  const { id } = await ctx.params;
  return updateCustomerController(request, id);
}
