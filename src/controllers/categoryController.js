import Category from "../models/Category.js";
import Product from "../models/Product.js";
import SubCategory from "../models/SubCategory.js";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const createCategory = async (req, res) => {
  try {
    const { name, image } = req.body;
    const slug = req.body.slug || toSlug(name);

    const exists = await Category.findOne({ slug });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await Category.create({
      name,
      slug,
      image,
    });

    res.status(201).json({
      success: true,
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const linkedSubCategories = await SubCategory.find({
      category: category._id,
    }).select("name slug category");

    let targetCategory = null;

    if (linkedSubCategories.length > 0) {
      if (req.body?.moveSubCategoriesTo) {
        if (String(req.body.moveSubCategoriesTo) === String(category._id)) {
          return res.status(400).json({
            success: false,
            message: "Choose a different category for reassignment",
          });
        }

        targetCategory = await Category.findById(req.body.moveSubCategoriesTo);
      } else if (req.body?.createCategory?.name) {
        const payload = req.body.createCategory;
        const slug = payload.slug || toSlug(payload.name);
        const exists = await Category.findOne({ slug });

        if (exists) {
          return res.status(400).json({
            success: false,
            message: "Destination category already exists",
          });
        }

        targetCategory = await Category.create({
          name: payload.name,
          slug,
          image: payload.image,
        });
      }

      if (!targetCategory) {
        const availableCategories = await Category.find({
          _id: { $ne: category._id },
        }).sort({ createdAt: -1 });

        return res.status(409).json({
          success: false,
          requiresReassignment: true,
          message:
            "This category has sub-categories. Move them before deleting.",
          category,
          subCategories: linkedSubCategories,
          availableCategories,
        });
      }

      const linkedSubCategoryIds = linkedSubCategories.map((item) => item._id);

      await SubCategory.updateMany(
        { _id: { $in: linkedSubCategoryIds } },
        { $set: { category: targetCategory._id } },
      );

      await Product.updateMany(
        {
          $or: [
            { category: category._id },
            { subCategory: { $in: linkedSubCategoryIds } },
            { subcategory: { $in: linkedSubCategoryIds } },
          ],
        },
        { $set: { category: targetCategory._id } },
      );
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: "Category deleted successfully",
      movedSubCategories: linkedSubCategories.length,
      destinationCategory: targetCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
