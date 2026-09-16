import type { NextRequest } from "next/server";

import { HTTP_STATUS, RESPONSE_CODE } from "@/constants";
import { signIn } from "@/lib/auth";
import { handleError, parseJsonBody, sendErrorResponse, sendSuccessResponse } from "@/lib/response";
import { verifyCredentials } from "@/lib/verify-credentials";
import { credentialsSchema } from "@/validations/auth.validation";

export async function loginController(request: NextRequest) {
  try {
    const credentials = await parseJsonBody(request, credentialsSchema);

    const user = await verifyCredentials(credentials);
    if (!user) {
      return sendErrorResponse(
        "Invalid email or password",
        RESPONSE_CODE.UNAUTHORIZED,
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    await signIn("credentials", { ...credentials, redirect: false });

    return sendSuccessResponse(
      { user },
      "Login successful",
      RESPONSE_CODE.LOGIN_SUCCESS,
      HTTP_STATUS.OK,
    );
  } catch (exception) {
    return handleError(exception, "auth");
  }
}
