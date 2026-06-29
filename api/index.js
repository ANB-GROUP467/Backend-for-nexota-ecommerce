import "dotenv/config";
import connectDB from "../src/config/db.js";
import app from "../src/app.js";

// Cache the DB connection across warm invocations
let isConnected = false;
import app from "../src/app.js";
import connectDB from "../src/config/db.js";

let isConnected = false;

export default async function handler(req, res) {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error("VERCEL FUNCTION STARTUP ERROR:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Serverless function failed",
    });
  }
}
