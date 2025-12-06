import { decode } from "hono/jwt";
import type { Role } from "@/schemas/user.schema.js";
import type { TokenPayload } from "@/services/token.service.js";

export function tokenDecoder(token: string) {
  const decoded = decode(token).payload as TokenPayload;

  const role = decoded.role as Role;

  return { id: decoded.id, role };
}
