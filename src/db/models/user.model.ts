import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import mongoose, { type Document } from "mongoose";
import { RolePermissions } from "@/lib/permissions.js";
import type { User } from "@/schemas/user.schema.js";
import { CRYPTO } from "@/index.js";

interface IUserMethods {
  comparePassword(password: string): Promise<boolean>;
}

export type mUser = Document &
  User &
  IUserMethods & {
    _id: Types.ObjectId;
    otpSecret?: string;
    createdAt: Date;
    updatedAt: Date;
  };

const mUserSchema = new mongoose.Schema<mUser>(
  {
    role: {
      type: String,
      required: true,
      enum: ["USER", "ADMIN", "GUEST", "SUPERADMIN"],
      default: "USER",
    },
    permissions: {
      type: [String],
      default: RolePermissions.user,
      required: true,
    },
    fullname: { type: String, required: true },
    username: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      trim: true,
      select: false,
    },

    googleId: { type: String, select: false },

    profileImg: String,

    refreshToken: { type: [String], default: [], select: false },

    otpSecret: {
      type: String,
      select: false,
    },

    twoFactorEnabled: { type: Boolean, default: false },

    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

mUserSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

mUserSchema.pre("save", async function () {
  if (this.isModified("otpSecret")) {
    const userSecret = await CRYPTO.encrypt(this.otpSecret);
    this.otpSecret = userSecret;
  }
});

mUserSchema.pre("save", async function () {
  const user = this as mUser;

  if (!user.isModified("password") || !user.password) {
    return;
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
});

const UserModel = mongoose.model<mUser>("User", mUserSchema);

export default UserModel;
