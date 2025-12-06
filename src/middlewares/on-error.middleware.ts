import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import {
  BAD_REQUEST,
  INTERNAL_SERVER_ERROR,
  OK,
} from "stoker/http-status-codes";
import { ZodError } from "zod";
import { AuthError } from "@/errors/auth.error.js";
import { handleZodError } from "@/errors/handlers/zod-error.handler.js";
import env from "@/lib/env-validator.js";
import logger from "@/lib/logger.js";

const isDevEnv = env.ENV !== "production";

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    const { error, message } = handleZodError(err);

    return c.json(
      {
        success: false,
        message: message || "Invalid request data",
        error,
      },
      { status: BAD_REQUEST },
    );
  }

  if (err instanceof AuthError) {
    logger.error(
      {
        url: c.req.url,
        method: c.req.method,
        userId: c.get("user")?.id,
        errorName: err.name,
        ...(isDevEnv && { stack: err.stack }),
      },
      err.message,
    );

    return c.json(
      {
        success: false,
        message: err.message,
        code: err?.code,
      },
      err.status,
    );
  }

  const currentStatus: number =
    "status" in err ? (err.status as number) : c.newResponse(null).status;

  const statusCode: StatusCode =
    currentStatus !== OK
      ? (currentStatus as StatusCode)
      : INTERNAL_SERVER_ERROR;

  const payload: Record<string, unknown> = {
    success: false,
    name: err?.name,
    message: err.message,
  };

  if (isDevEnv && err.stack) {
    payload.stack = err.stack;
  }

  logger.error(
    {
      url: c.req.url,
      method: c.req.method,
      userId: c.get("user")?.id,
      errorName: err?.name,
    },
    err.message,
  );

  return c.json(payload, {
    status: statusCode as unknown as ContentfulStatusCode,
  });
};
