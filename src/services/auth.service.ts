/** biome-ignore-all lint/complexity/noStaticOnlyClass: <...> */

import { Types } from "mongoose";
import UserModel from "@/db/models/user.model.js";
import { AuthError } from "@/errors/auth.error.js";
import { type TokenPayload, TokenService } from "@/services/token.service.js";

export class AuthService {
  private static async generateTokens(payload: TokenPayload) {
    return TokenService.createTokenPair(payload);
  }

  static async addRefreshToken(
    studentId: string | Types.ObjectId,
    refreshToken: string,
  ) {
    return UserModel.findByIdAndUpdate(
      studentId,
      { $addToSet: { refreshToken } },
      { new: true },
    );
  }

  static async removeRefreshToken(
    studentId: string | Types.ObjectId,
    refreshToken: string,
  ) {
    return UserModel.findByIdAndUpdate(studentId, {
      $pull: { refreshToken },
    });
  }

  static async findByRefreshToken(id: Types.ObjectId | string, token: string) {
    return UserModel.findOne({ _id: id, refreshToken: token });
  }

  static async refreshAuth(refreshToken: string) {
    const decoded = await TokenService.verifyRefreshToken(refreshToken);

    if (!decoded) {
      throw new AuthError("Invalid refresh token. Please log in again.");
    }

    const studentId = new Types.ObjectId(decoded.id);

    const student = await UserModel.findOneAndUpdate(
      { _id: studentId, refreshToken: refreshToken },
      { $pull: { refreshToken: refreshToken } },
    );

    if (!student) {
      await UserModel.updateOne(
        { _id: studentId },
        { $set: { refreshToken: [] } },
      );
      throw new AuthError("Invalid refresh token. Please log in again.");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await AuthService.generateTokens(decoded);

    await AuthService.addRefreshToken(student._id.toString(), newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
