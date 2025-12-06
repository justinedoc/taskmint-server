import { Hono } from "hono";
import { OK } from "stoker/http-status-codes";
import type { AppBindings } from "@/lib/create-app.js";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import analyticsService from "@/services/analytics.service.js";

const app = new Hono<AppBindings>()
  .basePath("/analytics")
  .use(authMiddleware)

  .get("/goal-summary", async (c) => {
    const { id: userId } = c.get("user");
    const data = await analyticsService.getGoalSummary(userId);
    return c.json(
      { success: true, data, message: "Goal summary retrieved successfully." },
      OK,
    );
  })
  .get("/weekly-productivity", async (c) => {
    const { id: userId } = c.get("user");
    const data = await analyticsService.getWeeklyProductivity(userId);
    return c.json(
      {
        success: true,
        data,
        message: "Weekly productivity retrieved successfully.",
      },
      OK,
    );
  });

export default app;
