import { isValidObjectId } from "mongoose";
import z from "zod";

export const TASK_PRIORITY = ["low", "medium", "high"] as const;
export const TASK_STATUS = ["not started", "in progress", "completed"] as const;

export const zTask = z
  .object({
    title: z
      .string({ error: "Title is required" })
      .min(1)
      .max(200, { error: "Title cannot be more than 200 characters" }),
    description: z.string().optional(),
    status: z.enum(TASK_STATUS).default(TASK_STATUS[0]),
    priority: z.enum(TASK_PRIORITY),

    startTime: z.coerce.date({ error: "Start time is required" }),
    endTime: z.coerce.date({ error: "End time is required" }),

    // Meta
    completed: z.boolean().default(false),
    syncToCalendar: z.boolean().optional().default(false),
    sendEmail: z.boolean().optional().default(false),

    googleEventId: z.string().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const zTasksParams = z.object({
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sortBy: z.enum(["title", "startTime", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  completed: z.coerce.boolean().optional(),
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(TASK_PRIORITY).optional(),
  date: z.coerce.date().optional(),
});

export const zTaskById = z.object({
  taskId: z.string().refine(isValidObjectId, { message: "Invalid task ID" }),
});

export type AllTasksQuery = z.infer<typeof zTasksParams>;
export type Task = z.infer<typeof zTask>;
