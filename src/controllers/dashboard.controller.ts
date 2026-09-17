import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { requireAuth } from "@/lib/guards";
import { handleError, sendSuccessResponse } from "@/lib/response";
import { getDashboardAnalytics } from "@/services/dashboard.service";

export async function getDashboardController() {
  try {
    const session = await requireAuth();
    const analytics = await getDashboardAnalytics(session);

    return sendSuccessResponse(analytics, "Dashboard fetched successfully", RESPONSE_CODE.SUCCESS, HTTP_STATUS.OK);
  } catch (exception) {
    return handleError(exception, "dashboard");
  }
}
