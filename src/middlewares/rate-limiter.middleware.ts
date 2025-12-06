import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

const keyGenerator = (c: Context) =>
  c.req.header("CF-Connecting-IP") ||
  c.req.header("X-Forwarded-For") ||
  c.req.header("X-Real-IP") ||
  "unknown";

// biome-ignore lint/suspicious/noExplicitAny: <...>
const handler = (c: Context, _: any, options: { windowMs: number }) => {
  c.status(429);
  c.header("Retry-After", Math.ceil(options.windowMs / 1000).toString());
  return c.json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

const defaultOptions = {
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  keyGenerator,
  handler,
};

export const createRateLimiter = (
  customOptions: Partial<typeof defaultOptions> = {},
) => {
  const options = {
    ...defaultOptions,
    ...customOptions,
  };

  return rateLimiter(options);
};
