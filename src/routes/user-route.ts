import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  OK,
} from "stoker/http-status-codes";
import z from "zod";
import cloudinary from "@/config/cloudinary.js";
import UserModel from "@/db/models/user.model.js";
import type { AppBindings } from "@/lib/create-app.js";
import { MAX_IMG_SIZE, zImage } from "@/lib/img-validator.js";
import { enforcePermission, Permission } from "@/lib/permissions.js";
import { zValidator } from "@/lib/zod-validator.js";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import { requirePermission } from "@/middlewares/require-permission.middleware.js";
import {
  zPasswordUpdate,
  zUpdateUser,
  zUserId,
} from "@/schemas/user.schema.js";
import { CloudinaryService } from "@/services/cloudinary.service.js";
import cookieService from "@/services/cookie.service.js";
import userService from "@/services/user.service.js";

const profileImageSchema = z.object({
  profileImg: zImage,
});

const app = new Hono<AppBindings>()
  .basePath("/user")

  .use(authMiddleware)

  /* GETS THE CURRENT USER */
  .get("/current", requirePermission(Permission.SELF_READ), async (c) => {
    const currentUser = c.get("user");

    const user = await UserModel.findById(currentUser.id);

    if (!user) {
      return c.json(
        { success: false, message: "User not found " },
        BAD_REQUEST,
      );
    }

    return c.json(
      {
        success: true,
        message: "successful",
        data: userService.profile(user),
      },
      OK,
    );
  })

  /* UPLOADS USER PROFILE PICTURE */
  .post(
    "/profile-picture",
    bodyLimit({
      maxSize: MAX_IMG_SIZE,
      onError: (c) => {
        return c.json(
          {
            success: false,
            message: `File size limit of ${MAX_IMG_SIZE / 1024 / 1024}MB exceeded.`,
          },
          BAD_REQUEST,
        );
      },
    }),
    zValidator("form", profileImageSchema),
    async (c) => {
      const { profileImg } = c.req.valid("form");
      const { id: userId } = c.get("user");

      const imageBuffer = Buffer.from(await profileImg.arrayBuffer());
      const dataURI = `data:${profileImg.type};base64,${imageBuffer.toString("base64")}`;

      const uploadResult = await CloudinaryService.uploadWithBase64(dataURI, {
        folder: "profile_pictures",
        public_id: userId,
      });

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { profileImg: uploadResult.secure_url },
        { new: true },
      ).select("profileImg");

      if (!updatedUser) {
        return c.json(
          { success: false, message: "User not found." },
          NOT_FOUND,
        );
      }

      return c.json(
        {
          success: true,
          message: "Profile picture updated successfully.",
          data: {
            profileImg: updatedUser.profileImg,
          },
        },
        OK,
      );
    },
  )

  /* DELETES USER PROFILE PICTURE */
  .delete("/profile-picture", async (c) => {
    const { id: userId } = c.get("user");
    const publicId = `profile_pictures/${userId}`;

    const deletionResult = await cloudinary.uploader.destroy(publicId);

    if (deletionResult.result !== "ok") {
      console.warn("Cloudinary deletion may have failed for:", publicId);
    }

    await UserModel.findByIdAndUpdate(userId, { $unset: { profileImg: "" } });

    return c.json(
      { success: true, message: "Profile picture removed successfully." },
      OK,
    );
  })

  /* TOGGLE USER 2FA */
  .post("/toggle-2fa", requirePermission(Permission.SELF_UPDATE), async (c) => {
    const { id: userId } = c.get("user");

    const user = await UserModel.findById(userId).select("+password");

    if (!user) {
      return c.json({ success: false, message: "User not found." }, NOT_FOUND);
    }

    if (!user.password) {
      return c.json(
        {
          success: false,
          message: "2FA cannot be toggled for accounts without a password.",
        },
        BAD_REQUEST,
      );
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { twoFactorEnabled: !user.twoFactorEnabled },
      { new: true, runValidators: true },
    ).select("twoFactorEnabled");

    if (!updatedUser) {
      return c.json(
        { success: false, message: "Failed to update 2FA setting." },
        NOT_FOUND,
      );
    }

    const newStatus = updatedUser.twoFactorEnabled ? "enabled" : "disabled";
    return c.json(
      {
        success: true,
        message: `Two-factor authentication has been ${newStatus}.`,
        data: { twoFactorEnabled: updatedUser.twoFactorEnabled },
      },
      OK,
    );
  })

  .patch("/change-password", zValidator("json", zPasswordUpdate), async (c) => {
    const { id: userId } = c.get("user");
    const passwordData = c.req.valid("json");

    const result = await userService.changePassword(userId, passwordData);

    return c.json(
      {
        success: true,
        message: result.message,
      },
      OK,
    );
  })

  /* UPDATES THE CURRENT USER */
  .patch(
    "/:id",
    zValidator("param", zUserId),
    zValidator("json", zUpdateUser),
    requirePermission(Permission.SELF_UPDATE),
    async (c) => {
      const targetUserId = c.req.valid("param");
      const data = c.req.valid("json");
      const currentUser = c.get("user");

      if (targetUserId.id !== currentUser.id) {
        return c.json(
          { success: false, message: "You can not perform this action!" },
          FORBIDDEN,
        );
      }

      const user = await userService.updateSafe(targetUserId.id, data);

      if (!user) {
        return c.json(
          {
            success: false,
            message:
              "An error occured while trying to update your profile, please try again later",
          },
          BAD_REQUEST,
        );
      }

      return c.json(
        {
          success: true,
          message: "User updated successfully",
          data: { user },
        },
        OK,
      );
    },
  )

  /* DELETES THE CURRENT USER */
  .delete(
    "/:id",
    zValidator("param", zUserId),
    requirePermission(Permission.SELF_DELETE, Permission.USER_DELETE),
    async (c) => {
      const { id: targetUserId } = c.req.valid("param");
      const currentUser = c.get("user");

      enforcePermission(
        currentUser,
        targetUserId,
        Permission.SELF_DELETE,
        Permission.USER_DELETE,
      );

      await UserModel.findByIdAndDelete(targetUserId);

      cookieService.deleteAuthCookies(c);

      return c.json(
        { success: false, message: "Account deleted successfully" },
        OK,
      );
    },
  );

export default app;
