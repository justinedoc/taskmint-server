import mongoose, { type Document, Schema, type Types } from "mongoose";
import {
  TASK_PRIORITY,
  TASK_STATUS,
  type Task,
} from "@/schemas/task.schema.js";

export type mTask = Document &
  Task & {
    _id: Types.ObjectId;
    user: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  };

const mTaskSchema = new mongoose.Schema<mTask>(
  {
    title: { type: String, required: true },
    status: { type: String, default: TASK_STATUS[0] },
    description: String,
    priority: { type: String, enum: TASK_PRIORITY, required: true },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    completed: { type: Boolean, required: true, default: false },

    googleEventId: { type: String },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

mTaskSchema.index({ user: 1, startTime: 1 });
mTaskSchema.index({ user: 1, status: 1 });

const TaskModel = mongoose.model<mTask>("Task", mTaskSchema);

export default TaskModel;
