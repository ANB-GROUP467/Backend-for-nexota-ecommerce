import Brand from "../models/Brand.js";
import Product from "../models/Product.js";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getBrandProductQuery = (brand) => ({
  $or: [
    { brand: brand._id },
    { brandId: brand._id },
    { brand_id: brand._id },
    { brand: brand.slug },
    { brandId: brand.slug },
    { brand_id: brand.slug },
    { brand: brand.name },
    { brandName: brand.name },
    { brandTitle: brand.name },
    { brand_slug: brand.slug },
  ],
});

export const createBrand = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      slug: req.body.slug || toSlug(req.body.name),
    };

    const brand = await Brand.create(payload);

    res.status(201).json({
      success: true,
      brand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    res.json({
      success: true,
      brand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    res.json({
      success: true,
      brand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";

export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { moveProductsTo, createBrand } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand id",
      });
    }

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const linkedProducts = await Product.find({ brand: id }).select("_id");

    if (linkedProducts.length > 0) {
      let targetBrandId = moveProductsTo;

      if (createBrand?.name) {
        const createdBrand = await Brand.create({
          name: createBrand.name,
          slug: createBrand.slug,
          logo: createBrand.logo || "",
        });

        targetBrandId = createdBrand._id;
      }

      if (!targetBrandId || !mongoose.Types.ObjectId.isValid(targetBrandId)) {
        return res.status(400).json({
          success: false,
          message:
            "This brand has linked products. Select another brand or create a new brand before deleting.",
        });
      }

      const targetBrand = await Brand.findById(targetBrandId);

      if (!targetBrand) {
        return res.status(404).json({
          success: false,
          message: "Target brand not found",
        });
      }

      await Product.updateMany(
        { brand: id },
        { $set: { brand: targetBrandId } },
      );
    }

    await Brand.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    console.error("Delete brand error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Delete brand failed",
    });
  }
};
