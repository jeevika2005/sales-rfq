import type { NextRequest } from "next/server";

import {
  createCustomerController,
  listCustomersController,
} from "@/controllers/customer.controller";

export async function GET(request: NextRequest) {
  return listCustomersController(request);
}

export async function POST(request: NextRequest) {
  return createCustomerController(request);
}
