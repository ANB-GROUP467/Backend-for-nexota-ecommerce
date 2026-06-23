import express from "express";

import {
  createDeal,
  deleteDeal,
  getActiveDeals,
  getDealById,
  getDealBySlug,
  getDeals,
  updateDeal,
} from "../controllers/dealController.js";

const router = express.Router();

router.get("/active", getActiveDeals);
router.get("/slug/:slug", getDealBySlug);
router.post("/", createDeal);
router.get("/", getDeals);
router.get("/:id", getDealById);
router.put("/:id", updateDeal);
router.delete("/:id", deleteDeal);

export default router;
