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

const handleProductImagesUpload = (req, res, next) => {
  upload.array("images", 10)(req, res, (error) => {
    if (error) {
      console.error("Product image upload error:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Image upload failed",
      });
    }

    next();
  });
};

// Specific routes must be declared before /:id.
router.get("/", getProducts);
router.get("/search/:keyword", searchProducts);
router.get("/filter/all", filterProducts);
router.get("/featured", getFeaturedProducts);
router.get("/best-sellers", getBestSellerProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);

router.post("/", handleProductImagesUpload, createProduct);
router.put("/:id", handleProductImagesUpload, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
