import { endOfDay, startOfDay } from "date-fns";
import type { QueryFilter } from "mongoose";
import { BAD_REQUEST, NOT_FOUND } from "stoker/http-status-codes";
import Task, { type mTask } from "@/db/models/task.model.js";
import { TaskError } from "@/errors/tasks.error.js";
import type { AllTasksQuery, Task as BaseTask } from "@/schemas/task.schema.js";

type TNewTask = Omit<BaseTask, "_id" | "user">;

class TaskService {
  async create(taskDetails: TNewTask, userId: string) {
    const task = await Task.create({ ...taskDetails, user: userId });
    if (!task) throw new TaskError("Failed to create task", BAD_REQUEST);
    return task;
  }

  async getById(taskId: string, userId: string) {
    const task = await Task.findOne({
      _id: taskId,
      user: userId,
    }).lean<BaseTask>();

    if (!task) throw new TaskError("Task not found", NOT_FOUND);

    return task;
  }

  async update(taskDetails: Partial<TNewTask>, taskId: string, userId: string) {
    const task = await Task.findOneAndUpdate(
      { _id: taskId, user: userId },
      taskDetails,
      {
        new: true,
        runValidators: true,
      },
    ).lean<BaseTask>();

    if (!task) throw new TaskError("Failed to update task", BAD_REQUEST);

    return task;
  }

  async delete(taskId: string, userId: string) {
    const task = await Task.findOneAndDelete(
      {
        _id: taskId,
        user: userId,
      },
      { new: true },
    ).lean<BaseTask>();

    if (!task)
      throw new TaskError(
        "Failed to delete task or task already deleted",
        NOT_FOUND,
      );
    return task;
  }

  async getAll(query: AllTasksQuery, userId: string) {
    const {
      status,
      sortOrder = "asc",
      date,
      limit = 10, 
      page = 1, 
      priority,
      search,
      sortBy = "startTime", 
      completed,
    } = query;

    const skip = (page - 1) * limit;

    const sortQuery: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const filterQuery: QueryFilter<mTask> = {
      user: userId,
      ...(status && { status }),
      ...(typeof completed === "boolean" && { completed }),
      ...(priority && { priority }),
    };

    if (date) {
      const targetDate = new Date(date);
      filterQuery.startTime = {
        $gte: startOfDay(targetDate),
        $lte: endOfDay(targetDate),
      };
    }

    if (search) {
      const pattern = new RegExp(search, "i");
      filterQuery.$or = [{ title: pattern }, { description: pattern }];
    }

    const tasksQuery = Task.find(filterQuery)
      .populate<{ user: BaseTask }>(
        "user",
        "-refreshToken -comparePassword -__v -password -otpSecret -permissions -createdAt -updatedAt -twoFactorEnabled -isVerified -profileImg",
      )
      .select("-__v")
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();

    const countQuery = Task.countDocuments(filterQuery);

    const [tasksList, totalCount] = await Promise.all([
      tasksQuery.exec(),
      countQuery.exec(),
    ]);

    const hasNextPage = totalCount > page * limit;
    const hasPrevPage = page > 1;
    const nextPage = hasNextPage ? page + 1 : null;
    const prevPage = hasPrevPage ? page - 1 : null;

    return {
      tasks: tasksList || [],
      meta: {
        total: totalCount,
        nextPage,
        prevPage,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}

const taskService = new TaskService();
export default taskService;
