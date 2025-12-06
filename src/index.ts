import "dotenv/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { NOT_FOUND, OK } from "stoker/http-status-codes";
import { createApp } from "@/lib/create-app.js";
import env from "@/lib/env-validator.js";
import analyticsRoute from "@/routes/analytics-route.js";
import authRoute from "@/routes/auth-route.js";
import tasksRoute from "@/routes/tasks-route.js";
import userRoute from "@/routes/user-route.js";
import verificationRoute from "@/routes/verify-route.js";
import { getCryptoService } from "@/services/crypto.service.js";

const app = await createApp(Hono);
export const CRYPTO = await getCryptoService();

app.get("/", (c) => {
  return c.json({ success: true, message: "Welcome to TaskMint API!" }, OK);
});

app.get("/health", (c) => {
  return c.json(
    {
      status: "OK",
      uptime: process.uptime(),
      message: "Server is up and running",
    },
    OK,
  );
});

app.route("/v1", authRoute);
app.route("/v1", userRoute);
app.route("/v1", tasksRoute);
app.route("/v1", analyticsRoute);
app.route("/v1", verificationRoute);

app.notFound((c) => {
  return c.json({ message: `Route not found - ${c.req.path}` }, NOT_FOUND);
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

export type AppType = typeof app;

export default app;
