import { getDashboardController } from "@/controllers/dashboard.controller";

export async function GET() {
  return getDashboardController();
}
