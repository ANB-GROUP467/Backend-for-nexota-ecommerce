import express from "express";

import {
  createSaleBanner,
  deleteSaleBanner,
  getActiveSaleBanners,
  getSaleBannerById,
  getSaleBanners,
  updateSaleBanner,
} from "../controllers/saleBannerController.js";

const router = express.Router();

router.get("/active", getActiveSaleBanners);
router.post("/", createSaleBanner);
router.get("/", getSaleBanners);
router.get("/:id", getSaleBannerById);
router.put("/:id", updateSaleBanner);
router.delete("/:id", deleteSaleBanner);

export default router;
