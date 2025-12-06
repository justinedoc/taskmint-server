/** biome-ignore-all lint/complexity/noStaticOnlyClass: <...> */
import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { Types } from "mongoose";
import env from "@/lib/env-validator.js";
import type { Role } from "@/schemas/user.schema.js";

export interface TokenPayload extends JWTPayload {
  id: string;
  role: Role;
  twoFactorEnabled: boolean;
  permissions?: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  public static async createTokenPair({
    id,
    role,
    permissions,
    twoFactorEnabled,
  }: {
    id: Types.ObjectId | string;
    role: Role;
    permissions?: string[];
    twoFactorEnabled: boolean;
  }): Promise<TokenPair> {
    const payload: TokenPayload = {
      id: id.toString(),
      role,
      permissions,
      twoFactorEnabled,
    };

    const now = Math.floor(Date.now() / 1000);
    const accessTokenExp = now + 60 * 15;
    const refreshTokenExp = now + 60 * 60 * 24 * 7;

    const accessToken = await sign(
      { ...payload, exp: accessTokenExp },
      env.ACCESS_TOKEN_SECRET,
    );
    const refreshToken = await sign(
      { ...payload, exp: refreshTokenExp },
      env.REFRESH_TOKEN_SECRET,
    );

    return { accessToken, refreshToken };
  }

  public static async createOtpToken({
    id,
    role,
    permissions,
    twoFactorEnabled,
  }: {
    id: Types.ObjectId | string;
    role: Role;
    permissions?: string[];
    twoFactorEnabled: boolean;
  }): Promise<string> {
    const payload: TokenPayload = {
      id: id.toString(),
      role,
      permissions,
      twoFactorEnabled,
    };

    const now = Math.floor(Date.now() / 1000);
    const otpTokenExp = now + 60 * 5;

    const otpToken = await sign(
      { ...payload, exp: otpTokenExp },
      env.OTP_TOKEN_SECRET,
    );

    return otpToken;
  }

  public static async verifyToken(
    token: string,
    secret: string,
  ): Promise<TokenPayload> {
    return (await verify(token, secret)) as TokenPayload;
  }

  static async verifyAccessToken(token: string) {
    return await TokenService.verifyToken(token, env.ACCESS_TOKEN_SECRET);
  }

  static async verifyRefreshToken(token: string) {
    return await TokenService.verifyToken(token, env.REFRESH_TOKEN_SECRET);
  }

  static async verifyOtpToken(token: string) {
    return await TokenService.verifyToken(token, env.OTP_TOKEN_SECRET);
  }
}
