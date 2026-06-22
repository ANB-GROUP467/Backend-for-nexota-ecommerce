import express from "express";

import {
  createReview,
  getProductReviews,
  getAllReviews,
  deleteReview,
} from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", createReview);
router.get("/", getAllReviews);
router.get("/product/:productId", getProductReviews);
router.delete("/:id", deleteReview);

export default router;
