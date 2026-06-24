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

const asyncHandler = (controller) => {
  return (req, res, next) => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
};

const uploadProductImages = (req, res, next) => {
  upload.array("images", 10)(req, res, (error) => {
    if (error) {
      console.error("PRODUCT IMAGE UPLOAD ERROR:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      return res.status(400).json({
        success: false,
        message: error.message || "Image upload failed",
      });
    }

    next();
  });
};

router.get("/", asyncHandler(getProducts));
router.get("/search/:keyword", asyncHandler(searchProducts));
router.get("/filter/all", asyncHandler(filterProducts));
router.get("/featured", asyncHandler(getFeaturedProducts));
router.get("/best-sellers", asyncHandler(getBestSellerProducts));
router.get("/slug/:slug", asyncHandler(getProductBySlug));
router.get("/:id", asyncHandler(getProductById));

router.post("/", uploadProductImages, asyncHandler(createProduct));
router.put("/:id", uploadProductImages, asyncHandler(updateProduct));
router.delete("/:id", asyncHandler(deleteProduct));

export default router;
