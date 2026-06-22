import express from "express";

import {
  createSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategoryController.js";

const router = express.Router();

router.post("/", createSubCategory);

router.get("/", getSubCategories);

router.get("/:id", getSubCategoryById);

router.put("/:id", updateSubCategory);

router.delete("/:id", deleteSubCategory);

export default router;
