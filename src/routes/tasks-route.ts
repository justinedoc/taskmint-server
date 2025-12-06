import { Hono } from "hono";
import { OK } from "stoker/http-status-codes";
import type { AppBindings } from "@/lib/create-app.js";
import { zValidator } from "@/lib/zod-validator.js";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import { zTask, zTaskById, zTasksParams } from "@/schemas/task.schema.js";
import taskService from "@/services/task.service.js";

const app = new Hono<AppBindings>()
  .basePath("/tasks")

  .use(authMiddleware)

  .get("/", zValidator("query", zTasksParams), async (c) => {
    const query = c.req.valid("query");
    const { id: userId } = c.get("user");

    const data = await taskService.getAll(query, userId);

    return c.json(
      {
        success: true,
        message: "Tasks retrieved successfully",
        data,
      },
      OK,
    );
  })

  .get("/:taskId", zValidator("param", zTaskById), async (c) => {
    const { id: userId } = c.get("user");
    const { taskId } = c.req.valid("param");

    const task = await taskService.getById(taskId, userId);

    return c.json(
      {
        success: true,
        message: `Fetched task with ID: ${taskId}`,
        data: { task },
      },
      OK,
    );
  })

  .post("/", zValidator("json", zTask), async (c) => {
    const { id: userId } = c.get("user");
    const data = c.req.valid("json");

    const task = await taskService.create(data, userId);

    return c.json(
      {
        success: true,
        message: "Task created successfully",
        data: { task },
      },
      OK,
    );
  })

  .patch(
    "/:taskId",
    zValidator("param", zTaskById),
    zValidator("json", zTask.partial()),
    async (c) => {
      const { id: userId } = c.get("user");
      const { taskId } = c.req.valid("param");
      const taskDetails = c.req.valid("json");

      const task = await taskService.update(taskDetails, taskId, userId);

      return c.json(
        {
          success: true,
          message: "Task updated successfully",
          data: { task },
        },
        OK,
      );
    },
  )

  .delete("/:taskId", zValidator("param", zTaskById), async (c) => {
    const { taskId } = c.req.valid("param");
    const userId = c.get("user").id;

    const task = await taskService.delete(taskId, userId);

    return c.json(
      {
        success: true,
        message: "Task deleted successfully",
        data: { task },
      },
      OK,
    );
  });

export default app;
