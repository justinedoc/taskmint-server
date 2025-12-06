import { isValidObjectId } from "mongoose";
import z from "zod";

// Enums
export const Role = z.enum(["USER", "ADMIN", "GUEST", "SUPERADMIN"]);

// 2. Base User Schema
export const zUser = z.object({
  role: Role.default("USER"),
  fullname: z.string().min(1, { error: "Full name is required" }).max(100),
  username: z.string().min(1).max(100).optional(),

  email: z
    .string({ error: "Email is required" })
    .email({ message: "Please use a valid email" })
    .transform((e) => e.toLowerCase()),

  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(50)
    .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
      message: "Password must contain at least one letter and one number",
    }),

  permissions: z.array(z.string()).optional(),
  refreshToken: z.array(z.string()).optional(),
  profileImg: z.string().optional(),
  twoFactorEnabled: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  googleId: z.string().optional(),
});

/* Derived Schemas */

/**
 * For Registration (Omits system fields)
 */
export const zRegisterUser = zUser.omit({
  role: true,
  permissions: true,
  refreshToken: true,
  isVerified: true,
  twoFactorEnabled: true,
  googleId: true,
  profileImg: true,
});

/**
 * For Signin (Loose validation on inputs, strict on structure)
 */
export const zSignin = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string(),
});

/**
 * For ID Validation
 */
export const zUserId = z.object({
  id: z.string({ error: "User ID is required" }).refine(isValidObjectId, {
    message: "Invalid User ID format",
  }),
});

/**
 * For Updating Profile (Partial update of specific fields)
 */
export const zUpdateUser = zUser
  .pick({
    fullname: true,
    username: true,
    profileImg: true,
    twoFactorEnabled: true,
  })
  .partial();

/**
 * For Password Change
 */
export const zPasswordUpdate = z.object({
  oldPassword: z.string(),
  newPassword: zUser.shape.password,
});

export type Role = z.infer<typeof Role>;
export type User = z.infer<typeof zUser>;
