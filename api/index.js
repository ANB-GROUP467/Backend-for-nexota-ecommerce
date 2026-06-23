import dotenv from "dotenv";
dotenv.config();

import connectDB from "../src/config/db.js";
import app from "../src/app.js";

connectDB();

export default app;
