import type { Context, Next } from "hono";
import { FORBIDDEN } from "stoker/http-status-codes";
import { AuthError } from "@/errors/auth.error.js";
import { hasPermission, type Permission } from "@/lib/permissions.js";
import type { TokenPayload } from "@/services/token.service.js";

export function requirePermission(...requiredPermissions: Permission[]) {
  return async (c: Context, next: Next) => {
    const { role, permissions } = c.get("user") as TokenPayload;

    if (!hasPermission({ role, permissions }, requiredPermissions)) {
      throw new AuthError(
        "Insufficient permission to access this resource",
        FORBIDDEN,
      );
    }

    return next();
  };
}
