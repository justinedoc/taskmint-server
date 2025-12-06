import type { Context, Next } from "hono";
import { UNAUTHORIZED } from "stoker/http-status-codes";
import { AuthError } from "@/errors/auth.error.js";
import cookieService from "@/services/cookie.service.js";
import { TokenService } from "@/services/token.service.js";

export async function otpMiddleware(c: Context, next: Next) {
  const otpToken = await cookieService.getOtpCookie(c);


  if (!otpToken) {
    throw new AuthError(
      "Authentication required: No temporary session token found.",
      UNAUTHORIZED,
      "NO_OTP_TOKEN",
    );
  }

  try {
    const decoded = await TokenService.verifyOtpToken(otpToken);
    c.set("unverifiedUser", decoded);
    await next();
  } catch {
    throw new AuthError(
      "Temporary session token is invalid or expired. Please sign in again.",
      UNAUTHORIZED,
      "OTP_TOKEN_INVALID",
    );
  }
}
