import "dotenv/config";
import connectDB from "../src/config/db.js";
import app from "../src/app.js";

// Cache the DB connection across warm invocations
let isConnected = false;

const handler = async (req, res) => {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }
  } catch (error) {
    console.error("Vercel database connection error:", error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Express 4 and 5 both support this pattern —
  // calling app(req, res) works because Express app IS a request handler function.
  // If Express 5 ever breaks this, the fallback is: app.handle(req, res, () => {})
  return new Promise((resolve) => {
    res.on("finish", resolve);
    app(req, res, resolve); // third arg handles cases where no route matches
  });
};

export default handler;
