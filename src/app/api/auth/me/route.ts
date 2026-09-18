import { meController } from "@/controllers/auth.controller";

export async function GET() {
  return meController();
}
