import type { NextRequest } from "next/server";

import {
  listCustomersController,
} from "@/controllers/customer.controller";

export async function GET() {
  return listCustomersController();
}
