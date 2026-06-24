import express from "express";

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

const asyncHandler = (controller) => {
  return (req, res, next) => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
};

router.get("/", asyncHandler(getProducts));
router.get("/search/:keyword", asyncHandler(searchProducts));
router.get("/filter/all", asyncHandler(filterProducts));
router.get("/featured", asyncHandler(getFeaturedProducts));
router.get("/best-sellers", asyncHandler(getBestSellerProducts));
router.get("/slug/:slug", asyncHandler(getProductBySlug));
router.get("/:id", asyncHandler(getProductById));

// Multer removed — images are now uploaded directly from the browser
// to Cloudinary. Backend receives only JSON with image URLs.
router.post("/", asyncHandler(createProduct));
router.put("/:id", asyncHandler(updateProduct));
router.delete("/:id", asyncHandler(deleteProduct));

export default router;
