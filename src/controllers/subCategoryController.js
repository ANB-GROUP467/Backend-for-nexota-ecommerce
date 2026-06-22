import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import SubCategory from "../models/SubCategory.js";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const createSubCategory = async (req, res) => {
  try {
    const { name, category, image, isActive } = req.body;

    const categoryId =
      typeof category === "object" ? category?._id || category?.id : category;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sub-category name is required",
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Parent category is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parent category ID",
      });
    }

    const parentCategory = await Category.findById(categoryId);

    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const slug = toSlug(req.body.slug || name);

    // FIX: scope uniqueness check to the same category, matching the schema index
    const existingSubCategory = await SubCategory.findOne({
      slug,
      category: categoryId,
    });

    if (existingSubCategory) {
      return res.status(409).json({
        success: false,
        message: `"${slug}" sub-category already exists in this category`,
      });
    }

    const subCategory = await SubCategory.create({
      name: name.trim(),
      slug,
      category: categoryId,
      image: typeof image === "string" ? image.trim() : "",
      isActive: isActive ?? true,
    });

    return res.status(201).json({
      success: true,
      message: "Sub-category created successfully",
      subCategory,
    });
  } catch (error) {
    console.error("CREATE SUBCATEGORY FULL ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This sub-category slug already exists in the selected category",
        duplicateField: error.keyValue,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
      errorName: error.name,
      errorCode: error.code,
    });
  }
};

export const getSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find({})
      .select("-image")
      .sort({ createdAt: -1 })
      .lean();

    const categoryIds = [
      ...new Set(
        subCategories
          .map((item) => item.category)
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => String(id)),
      ),
    ];

    const categories = await Category.find({
      _id: { $in: categoryIds },
    })
      .select("name slug")
      .lean();

    const categoryMap = new Map(
      categories.map((category) => [String(category._id), category]),
    );

    const populatedSubCategories = subCategories.map((subCategory) => ({
      ...subCategory,
      category:
        categoryMap.get(String(subCategory.category)) ||
        subCategory.category ||
        null,
    }));

    return res.status(200).json({
      success: true,
      count: populatedSubCategories.length,
      subCategories: populatedSubCategories,
      data: populatedSubCategories,
    });
  } catch (error) {
    console.error("GET /api/subcategories failed:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load subcategories",
    });
  }
};

export const getSubCategoryById = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id).populate(
      "category",
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    res.json({
      success: true,
      subCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateSubCategory = async (req, res) => {
  try {
    const { name, slug, category, image, isActive } = req.body;

    // FIX: whitelist fields instead of passing raw req.body
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (image !== undefined)
      updates.image = typeof image === "string" ? image.trim() : "";
    if (isActive !== undefined) updates.isActive = isActive;
    if (category !== undefined) updates.category = category;

    // Recompute slug from explicit slug field, or from name if name changed
    if (slug !== undefined) {
      updates.slug = toSlug(slug);
    } else if (name !== undefined) {
      updates.slug = toSlug(name);
    }

    // FIX: if slug is changing, check for conflicts within the target category
    if (updates.slug) {
      const existing = await SubCategory.findById(req.params.id).lean();

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "SubCategory not found",
        });
      }

      const targetCategoryId = updates.category ?? existing.category;

      const conflict = await SubCategory.findOne({
        slug: updates.slug,
        category: targetCategoryId,
        _id: { $ne: req.params.id }, // exclude self
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Slug "${updates.slug}" already exists in this category`,
        });
      }
    }

    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    ).populate("category");

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    res.json({
      success: true,
      subCategory,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This slug already exists in the selected category",
        duplicateField: error.keyValue,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found",
      });
    }

    const linkedProducts = await Product.find({
      $or: [
        { subCategory: subCategory._id },
        { subcategory: subCategory._id },
        { subCategoryId: subCategory._id },
        { subcategoryId: subCategory._id },
        { sub_category: subCategory._id },
        { sub_category_id: subCategory._id },
        { subCategory: subCategory.slug },
        { subcategory: subCategory.slug },
        { subCategoryId: subCategory.slug },
        { subcategoryId: subCategory.slug },
        { sub_category: subCategory.slug },
        { sub_category_id: subCategory.slug },
      ],
    }).select("title name slug image category subCategory subcategory");

    let targetSubCategory = null;
    let createdCategory = null;

    if (linkedProducts.length > 0) {
      if (req.body?.moveProductsTo) {
        if (String(req.body.moveProductsTo) === String(subCategory._id)) {
          return res.status(400).json({
            success: false,
            message: "Choose a different sub-category for reassignment",
          });
        }

        targetSubCategory = await SubCategory.findById(
          req.body.moveProductsTo,
        ).populate("category", "_id");
      } else if (req.body?.createSubCategory?.name) {
        const payload = req.body.createSubCategory;
        const slug = toSlug(payload.slug || payload.name);
        let parentCategory = null;

        if (payload.category) {
          parentCategory = await Category.findById(payload.category);
        } else if (payload.createCategory?.name) {
          const categorySlug = toSlug(
            payload.createCategory.slug || payload.createCategory.name,
          );
          const categoryExists = await Category.findOne({
            slug: categorySlug,
          });

          if (categoryExists) {
            return res.status(400).json({
              success: false,
              message: "Destination category already exists",
            });
          }

          parentCategory = await Category.create({
            name: payload.createCategory.name,
            slug: categorySlug,
            image: payload.createCategory.image,
          });
          createdCategory = parentCategory;
        }

        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            message: "Parent category is required for the new sub-category",
          });
        }

        // FIX: scope conflict check to the target category
        const exists = await SubCategory.findOne({
          slug,
          category: parentCategory._id,
        });

        if (exists) {
          return res.status(400).json({
            success: false,
            message: "Destination sub-category already exists in this category",
          });
        }

        targetSubCategory = await SubCategory.create({
          name: payload.name,
          slug,
          category: parentCategory._id,
          image: payload.image,
        });
      }

      if (!targetSubCategory) {
        const availableSubCategories = await SubCategory.find({
          _id: { $ne: subCategory._id },
        })
          .populate("category", "name slug image")
          .sort({ createdAt: -1 });

        const categories = await Category.find().sort({ createdAt: -1 });

        return res.status(409).json({
          success: false,
          requiresReassignment: true,
          message: "This sub-category has products. Move them before deleting.",
          products: linkedProducts,
          subCategory,
          availableSubCategories,
          categories,
        });
      }

      const targetCategoryId =
        targetSubCategory.category?._id || targetSubCategory.category;

      await Product.updateMany(
        {
          $or: [
            { subCategory: subCategory._id },
            { subcategory: subCategory._id },
            { subCategoryId: subCategory._id },
            { subcategoryId: subCategory._id },
            { sub_category: subCategory._id },
            { sub_category_id: subCategory._id },
            { subCategory: subCategory.slug },
            { subcategory: subCategory.slug },
            { subCategoryId: subCategory.slug },
            { subcategoryId: subCategory.slug },
            { sub_category: subCategory.slug },
            { sub_category_id: subCategory.slug },
          ],
        },
        {
          $set: {
            category: targetCategoryId,
            subCategory: targetSubCategory._id,
            subcategory: targetSubCategory._id,
          },
        },
      );
    }

    await subCategory.deleteOne();

    res.json({
      success: true,
      message: "SubCategory deleted successfully",
      movedProducts: linkedProducts.length,
      destinationSubCategory: targetSubCategory,
      createdCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
