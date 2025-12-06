import { Hono } from "hono";
import { CONFLICT, CREATED, OK, UNAUTHORIZED } from "stoker/http-status-codes";
import z from "zod";
import UserModel from "@/db/models/user.model.js";
import { AuthError } from "@/errors/auth.error.js";
import { tokenDecoder } from "@/lib/decode-token.js";
import env from "@/lib/env-validator.js";
import logger from "@/lib/logger.js";
import { zValidator } from "@/lib/zod-validator.js";
import { createRateLimiter } from "@/middlewares/rate-limiter.middleware.js";
import { zRegisterUser, zSignin } from "@/schemas/user.schema.js";
import cookieService from "@/services/cookie.service.js";
import googleAuthService, {
  type GoogleUserProfile,
} from "@/services/google-auth.service.js";
import mailer from "@/services/mailer.service.js";
import otpService from "@/services/otp.service.js";
import { type TokenPayload, TokenService } from "@/services/token.service.js";
import userService from "@/services/user.service.js";

const zGoogleAuth = z.object({
  idToken: z.string(),
});

const isDevMode = env.ENV !== "production";

const app = new Hono().basePath("/auth");

// ==========================
// GOOGLE AUTH
// ==========================
app.post("/google", zValidator("json", zGoogleAuth), async (c) => {
  const { idToken } = c.req.valid("json");

  let profile: GoogleUserProfile;
  try {
    profile = await googleAuthService.verifyIdToken(idToken);
  } catch (error) {
    console.error("Google token verification failed:", error);
    throw new AuthError("Invalid Google authentication token.", UNAUTHORIZED);
  }

  const user = await userService.handleGoogleSignIn(profile);

  const { accessToken, refreshToken } = await TokenService.createTokenPair({
    id: user._id,
    role: user.role,
    permissions: user.permissions,
    twoFactorEnabled: user.twoFactorEnabled,
  });

  await userService.addRefreshToken(user._id.toString(), refreshToken);
  await cookieService.setAuthCookies(c, { refreshToken, accessToken });

  console.info(`${user.fullname} logged in via Google`);

  return c.json(
    {
      success: true,
      message: "Google sign-in successful",
      data: { accessToken },
    },
    OK,
  );
});

// ==========================
// SIGNUP
// ==========================
app.post(
  "/signup",
  createRateLimiter({ limit: 10 }),
  zValidator("json", zRegisterUser),
  async (c) => {
    const incomingUser = c.req.valid("json");

    // Check Existence
    const userExists = await UserModel.exists({ email: incomingUser.email });

    if (userExists) {
      throw new AuthError("User with email already exists", CONFLICT);
    }

    const otpSecret = otpService.generateUserSecret();

    // Register
    const user = await userService.register({ ...incomingUser, otpSecret });

    // Generate & Send OTP
    const otpToken = await TokenService.createOtpToken({
      id: user._id,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    await cookieService.setOTPCookie(c, otpToken);
    const otpCode = await otpService.generateOtp(user.otpSecret);

    await mailer.sendMail({
      to: user.email,
      subject: "Welcome to TaskMint",
      template: "welcome",
      payload: { otp: otpCode, username: user.fullname },
    });

    console.info(`User ${user.fullname} has been registered`);

    return c.json(
      {
        success: true,
        message: "Signup successful",
        data: { otp: isDevMode && otpCode },
      },
      CREATED,
    );
  },
);

// ==========================
// LOGIN
// ==========================
app.post(
  "/signin",
  createRateLimiter({ limit: 15 }),
  zValidator("json", zSignin),
  async (c) => {
    const { email, password } = c.req.valid("json");

    // Verify Credentials
    const user = await userService.verifyCredentials(email, password);

    // Handle 2FA
    if (user.twoFactorEnabled) {
      const otpToken = await TokenService.createOtpToken({
        id: user._id,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      });

      await cookieService.setOTPCookie(c, otpToken);
      const otpCode = await otpService.generateOtp(user.otpSecret);

      await mailer.sendMail({
        to: user.email,
        subject: "Your TaskMint OTP",
        template: "otp",
        payload: { otp: otpCode },
      });

      return c.json(
        {
          success: true,
          message: "OTP required for signin",
          data: {
            otp: isDevMode && otpCode,
            twoFactorEnabled: true,
          },
        },
        OK,
      );
    }

    // 3. Normal Login Flow
    const { accessToken, refreshToken } = await TokenService.createTokenPair({
      id: user._id,
      role: user.role,
      permissions: user.permissions,
      twoFactorEnabled: user.twoFactorEnabled,
    });

    await userService.addRefreshToken(user._id.toString(), refreshToken);
    await cookieService.setAuthCookies(c, { refreshToken, accessToken });

    console.info(`${user.fullname} logged in`);

    return c.json(
      {
        success: true,
        message: "Signin successful",
        data: { accessToken, twoFactorEnabled: false, user },
      },
      OK,
    );
  },
);

// ==========================
// REFRESH
// ==========================
app.post("/refresh", createRateLimiter({ limit: 20 }), async (c) => {
  const oldRefreshToken = await cookieService.getRefreshCookie(c);

  if (!oldRefreshToken) {
    throw new AuthError("Session expired", UNAUTHORIZED);
  }

  // Verify token signature
  let payload: TokenPayload;
  try {
    payload = await TokenService.verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AuthError("Invalid refresh token", UNAUTHORIZED);
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken } =
    await TokenService.createTokenPair({
      id: payload.id,
      role: payload.role,
      twoFactorEnabled: payload.twoFactorEnabled,
      permissions: payload?.permissions,
    });

  // Rotate Token in DB
  await userService.rotateRefreshToken(
    payload.id,
    oldRefreshToken,
    newRefreshToken,
  );

  // Set Cookies
  await cookieService.setRefreshCookie(c, newRefreshToken);

  return c.json(
    {
      success: true,
      message: "Tokens refreshed",
      accessToken,
    },
    OK,
  );
});

// ==========================
// LOGOUT
// ==========================
app.post("/logout", async (c) => {
  const refreshToken = await cookieService.getRefreshCookie(c);

  cookieService.deleteAuthCookies(c);

  if (!refreshToken) {
    return c.json({ success: true, message: "Logout successful" });
  }

  // Best effort cleanup from DB
  try {
    const { id } = tokenDecoder(refreshToken);
    if (id) {
      await userService.removeRefreshToken(id, refreshToken);
    }
  } catch {
    logger.warn("Error cleaning up refresh token during logout");
  }

  return c.json({ success: true, message: "Logout successful" }, OK);
});

export default app;
