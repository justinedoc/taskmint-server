import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import env from "@/lib/env-validator.js";

class CookieService {
  private REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
  private ACCESS_COOKIE_MAX_AGE = 15 * 60;
  private OTP_COOKIE_MAX_AGE = 5 * 60;

  private cookieOptions = {
    httpOnly: true,
    secure: env.ENV === "production",
    sameSite: "Lax",
  } as const;

  async setAccessCookie(c: Context, accessToken: string): Promise<void> {
    await setSignedCookie(
      c,
      "access_token",
      accessToken,
      env.ACCESS_COOKIE_SECRET,
      {
        ...this.cookieOptions,
        maxAge: this.ACCESS_COOKIE_MAX_AGE,
      },
    );
  }

  async setRefreshCookie(c: Context, refreshToken: string): Promise<void> {
    await setSignedCookie(
      c,
      "refresh_token",
      refreshToken,
      env.REFRESH_COOKIE_SECRET,
      {
        ...this.cookieOptions,
        maxAge: this.REFRESH_COOKIE_MAX_AGE,
      },
    );
  }

  async setOTPCookie(c: Context, optToken: string): Promise<void> {
    await setSignedCookie(c, "session", optToken, env.OTP_COOKIE_SECRET, {
      ...this.cookieOptions,
      maxAge: this.OTP_COOKIE_MAX_AGE,
    });
  }

  async setAuthCookies(
    c: Context,
    tokens: { accessToken: string; refreshToken: string },
  ): Promise<void> {
    await Promise.all([
      this.setRefreshCookie(c, tokens.refreshToken),
    ]);
  }

  deleteAccessCookie(c: Context): void {
    deleteCookie(c, "access_token");
  }

  deleteRefreshCookie(c: Context): void {
    deleteCookie(c, "refresh_token");
  }

  deleteOtpCookie(c: Context): void {
    deleteCookie(c, "session");
  }

  deleteAuthCookies(c: Context): void {
    this.deleteAccessCookie(c);
    this.deleteRefreshCookie(c);
  }

  async getAccessCookie(c: Context) {
    return getSignedCookie(c, env.ACCESS_COOKIE_SECRET, "access_token");
  }

  async getRefreshCookie(c: Context) {
    return getSignedCookie(c, env.REFRESH_COOKIE_SECRET, "refresh_token");
  }

  async getOtpCookie(c: Context) {
    return getSignedCookie(c, env.REFRESH_COOKIE_SECRET, "session");
  }
}

const cookieService = new CookieService();
export default cookieService;
