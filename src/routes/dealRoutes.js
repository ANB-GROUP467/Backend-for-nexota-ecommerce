import express from "express";
import upload from "../middleware/uploadMiddleware.js";

import {
  createDeal,
  getDeals,
  getDealById,
  getDealBySlug,
  updateDeal,
  deleteDeal,
} from "../controllers/dealController.js";

const router = express.Router();

const asyncHandler = (controller) => {
  return (req, res, next) => {
    Promise.resolve(controller(req, res, next)).catch(next);
  };
};

const uploadDealImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Deal image upload failed",
      });
    }

    next();
  });
};

router.get("/", asyncHandler(getDeals));
router.get("/slug/:slug", asyncHandler(getDealBySlug));
router.get("/:id", asyncHandler(getDealById));

router.post("/", uploadDealImage, asyncHandler(createDeal));
router.put("/:id", uploadDealImage, asyncHandler(updateDeal));
router.delete("/:id", asyncHandler(deleteDeal));

export default router;
