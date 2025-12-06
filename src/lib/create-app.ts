import { OpenAPIHono } from "@hono/zod-openapi";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { serveEmojiFavicon } from "stoker/middlewares";
import { APP_ORIGINS } from "@/config/app-origins.js";
import connectDb from "@/config/connect-db.js";
import { onError } from "@/middlewares/on-error.middleware.js";
import { createRateLimiter } from "@/middlewares/rate-limiter.middleware.js";
import type { TokenPayload } from "@/services/token.service.js";

const CORS_OPTIONS = {
  origin: APP_ORIGINS,
  credentials: true,
};

export type AppBindings = {
  Variables: {
    user: TokenPayload;
    unverifiedUser: TokenPayload;
  };
};

export function createRouter() {
  return new OpenAPIHono({
    strict: false,
  }).basePath("/api");
}

// biome-ignore lint/suspicious/noExplicitAny: <...>
export async function createApp(_Hono: any) {
  await connectDb();
  const app = createRouter();

  app.use(serveEmojiFavicon("👤"));

  app.use(createRateLimiter());

  app.use(cors(CORS_OPTIONS));
  app.use(compress());
  app.use(secureHeaders());
  app.use(prettyJSON());
  app.use(logger());

  app.onError(onError);

  return app;
}
