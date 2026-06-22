import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
} from "../controllers/wishlistController.js";

const router = express.Router();

router.get("/", protect, getWishlist);
router.get("/my", protect, getWishlist);

router.post("/", protect, addToWishlist);

router.delete("/clear", protect, clearWishlist);
router.delete("/:productId", protect, removeFromWishlist);
router.delete("/", protect, removeFromWishlist);

export default router;
