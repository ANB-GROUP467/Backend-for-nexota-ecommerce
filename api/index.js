import "dotenv/config";

import app from "../src/app.js";
import connectDB from "../src/config/db.js";

let databaseConnectionPromise = null;

const ensureDatabaseConnection = async () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDB().catch((error) => {
      // Allow a later invocation to retry if connection failed
      databaseConnectionPromise = null;
      throw error;
    });
  }

  return databaseConnectionPromise;
};

export default async function handler(req, res) {
  try {
    await ensureDatabaseConnection();
    return app(req, res);
  } catch (error) {
    console.error("VERCEL FUNCTION STARTUP ERROR:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });

    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "Server initialization failed"
          : error?.message || "Serverless function failed",
    });
  }
}
