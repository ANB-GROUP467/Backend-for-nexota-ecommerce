import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  createProduct,
  getProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  searchProducts,
  deleteProduct,
  filterProducts,
  getFeaturedProducts,
  getBestSellerProducts,
} from "../controllers/productController.js";

const router = express.Router();

// Specific routes must be declared before /:id.
router.get("/", getProducts);
router.get("/search/:keyword", searchProducts);
router.get("/filter/all", filterProducts);
router.get("/featured", getFeaturedProducts);
router.get("/best-sellers", getBestSellerProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);

router.post("/", upload.array("images", 10), createProduct);
router.put("/:id", upload.array("images", 10), updateProduct);
router.delete("/:id", deleteProduct);

export default router;
