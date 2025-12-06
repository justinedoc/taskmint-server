import { zValidator as zv } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodError, ZodType } from "zod";
import { handleZodError } from "@/errors/handlers/zod-error.handler.js";

export const zValidator = <
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result) => {
    if (!result.success) {
      const { error, message } = handleZodError(
        result.error as unknown as ZodError<unknown>,
      );
      throw new HTTPException(400, { message, cause: error });
    }
  });
