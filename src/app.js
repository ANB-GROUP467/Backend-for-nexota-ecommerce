import express from "express";
import cors from "cors";
import authRoutes from "./routes/authroutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import subCategoryRoutes from "./routes/subCategoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import orderRoutes from "./routes/orderRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());

app.use(express.json());
app.use("/reviews", reviewRoutes);
app.use("/categories", categoryRoutes);
app.use("/brands", brandRoutes);
app.use("/subcategories", subCategoryRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/auth", authRoutes);
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Nexota API Running",
  });
});

export default app;
