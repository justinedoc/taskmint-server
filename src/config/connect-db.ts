import mongoose from "mongoose";
import env from "@/lib/env-validator.js";
import logger from "@/lib/logger.js";

import "@/db/models/user.model.js";

export default async function connectDb() {
  try {
    if (mongoose.connection.readyState >= 1) {
      logger.info("Database is already connected.");
      return;
    }
    logger.info("Connecting to database...");
    await mongoose.connect(env.MONGODB_URI);
    logger.info("Connected to database!");
  } catch (err) {
    logger.error(err, "Database connection error");
    process.exit(1);
  }
}
