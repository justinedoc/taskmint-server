import type { Context, Next } from "hono";
import { JwtTokenExpired } from "hono/utils/jwt/types";
import {
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  UNAUTHORIZED,
} from "stoker/http-status-codes";
import UserModel from "@/db/models/user.model.js";
import { AuthError } from "@/errors/auth.error.js";
import logger from "@/lib/logger.js";
import { TokenService } from "@/services/token.service.js";

export async function authMiddleware(c: Context, next: Next) {
  const accessToken = c.req.header("Authorization")?.split(" ")[1];

  if (!accessToken) {
    throw new AuthError("Missing access token", UNAUTHORIZED, "NO_TOKEN");
  }

  try {
    const decoded = await TokenService.verifyAccessToken(accessToken);

    const userExists = await UserModel.exists({ _id: decoded.id });

    if (!userExists) {
      throw new AuthError("Access Denied", FORBIDDEN, "NOT_FOUND");
    }

    c.set("user", decoded);
    console.info(`user ${decoded.id} authenticated as ${decoded.role}`);
    await next();
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }

    if (err instanceof JwtTokenExpired) {
      return c.json(
        {
          success: false,
          message: "Access token has expired",
          code: "TOKEN_EXPIRED",
        },
        UNAUTHORIZED,
      );
    }

    logger.error("An unexpected error occurred during authentication");
    console.log(err);

    return c.json(
      {
        success: false,
        message:
          (err as Error)?.message ||
          "An unexpected error occurred during authentication",
        code: "UNEXPECTED_ERROR",
        error: err,
      },
      INTERNAL_SERVER_ERROR,
    );
  }
}
