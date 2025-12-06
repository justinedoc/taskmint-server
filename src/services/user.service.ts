import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from "stoker/http-status-codes";
import type z from "zod";
import UserModel, { type mUser } from "@/db/models/user.model.js";
import { AuthError } from "@/errors/auth.error.js";
import { CRYPTO } from "@/index.js";
import type {
  Role,
  zPasswordUpdate,
  zRegisterUser,
  zUpdateUser,
} from "@/schemas/user.schema.js";
import type { GoogleUserProfile } from "@/services/google-auth.service.js";
import otpService from "@/services/otp.service.js";

export class UserService {
  profile(user: mUser) {
    return {
      id: user._id.toString(),
      fullname: user.fullname,
      email: user.email,
      username: user.username,
      role: user.role,
      profileImg: user.profileImg,
      twoFactorEnabled: user.twoFactorEnabled,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Fetch a user by ID and return their sanitized profile.
   */
  async getPublicProfileById(userId: string) {
    const user = await UserModel.findById(userId);

    if (!user) {
      throw new AuthError("User not found", NOT_FOUND);
    }

    return this.profile(user);
  }

  // ==========================================
  //  AUTHENTICATION LOGIC
  // ==========================================

  /**
   * Verifies email/password combination.
   */
  async verifyCredentials(email: string, password: string) {
    const user = await UserModel.findOne({ email }).select(
      "+password +otpSecret",
    );

    if (!user || !user.password) {
      throw new AuthError("Invalid email or password", UNAUTHORIZED);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthError("Invalid email or password", UNAUTHORIZED);
    }

    return user;
  }

  /**
   * Handles the secure password change logic.
   */
  public async changePassword(
    userId: string,
    data: z.infer<typeof zPasswordUpdate>,
  ) {
    const user = await UserModel.findById(userId).select("+password");

    if (!user) {
      throw new AuthError("User not found", NOT_FOUND);
    }

    if (!user.password) {
      throw new AuthError(
        "You are logged in via Google. Please set a password first via the 'Forgot Password' flow.",
        BAD_REQUEST,
      );
    }

    const isMatch = await user.comparePassword(data.oldPassword);
    if (!isMatch) {
      throw new AuthError("Incorrect old password", BAD_REQUEST);
    }

    user.password = data.newPassword;
    await user.save();

    return { message: "Password updated successfully" };
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  /**
   * Updates user profile data safely.
   */
  async updateSafe(userId: string, data: z.infer<typeof zUpdateUser>) {
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      throw new AuthError("User not found", NOT_FOUND);
    }

    return this.profile(updatedUser);
  }

  /**
   * Registers a new user via Email/Password
   */
  async register(data: z.infer<typeof zRegisterUser> & { otpSecret: string }) {
    const { email, fullname, password, otpSecret } = data;

    const username = await this.generateUniqueUsername(email);

    const user = await UserModel.create({
      fullname,
      email,
      password,
      role: "USER" as Role,
      isVerified: false,
      twoFactorEnabled: false,
      otpSecret,
      username,
    });

    return user;
  }

  /**
   * Adds a refresh token to the user's whitelist
   */
  async addRefreshToken(userId: string, token: string) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $push: { refreshToken: token } },
      { new: true },
    );
    return user;
  }

  /**
   * Removes a specific refresh token (Logout)
   */
  async removeRefreshToken(userId: string, token: string) {
    return UserModel.findByIdAndUpdate(userId, {
      $pull: { refreshToken: token },
    });
  }

  /**
   * Rotates refresh tokens (Security best practice)
   * Removes the old one and adds the new one in a single atomic operation
   */
  async rotateRefreshToken(userId: string, oldToken: string, newToken: string) {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, refreshToken: oldToken },
      {
        $set: {
          "refreshToken.$": newToken,
        },
      },
      { new: true },
    );

    if (!user) {
      throw new AuthError("Invalid or expired refresh token", UNAUTHORIZED);
    }

    return user;
  }

  public async handleGoogleSignIn(profile: GoogleUserProfile): Promise<mUser> {
    const { id: googleId, email, name, picture } = profile;

    const existingLocalUser = await UserModel.findOne({ email });

    if (existingLocalUser) {
      // Logic: Link Google to existing account if not already linked
      if (!existingLocalUser.googleId) {
        existingLocalUser.googleId = googleId;
        existingLocalUser.isVerified = true;
        if (!existingLocalUser.profileImg)
          existingLocalUser.profileImg = picture;
        return existingLocalUser.save();
      }
      return existingLocalUser;
    }

    // New User Logic //
    const userOtpSecret = await CRYPTO.encrypt(otpService.generateUserSecret());

    const username = await this.generateUniqueUsername(email);

    const user = await UserModel.create({
      fullname: name,
      email: email,
      role: "USER" as Role,
      isVerified: true,
      twoFactorEnabled: false,
      profileImg: picture,
      otpSecret: userOtpSecret,
      username: username,
      googleId: googleId,
    });

    return user;
  }

  // ==========================================
  //  UTILITIES
  // ==========================================

  private async generateUniqueUsername(email: string): Promise<string> {
    const base = email.split("@")[0] ?? "user";
    const cleanBase = base.replace(/[^a-zA-Z0-9]/g, "");

    let candidate = cleanBase;
    let count = 1;

    while (await UserModel.exists({ username: candidate })) {
      candidate = `${cleanBase}${count++}`;
    }
    return candidate;
  }
}

const userService = new UserService();
export default userService;
