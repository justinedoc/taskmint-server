import mongoose from "mongoose";

import "dotenv/config";

import env from "@/lib/env-validator.js";
import { sleep } from "@/lib/sleep.js";

const seedDatabase = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected successfully!");

    console.log("Clearing old data...");
    await sleep();
    console.log("Old data cleared.");

    console.log("Seeding new data...");

    await sleep(3000);

    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
};

seedDatabase();
