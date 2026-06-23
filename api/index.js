import "dotenv/config";

import connectDB from "../src/config/db.js";
import app from "../src/app.js";

const handler = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Vercel database error:", error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export default handler;
