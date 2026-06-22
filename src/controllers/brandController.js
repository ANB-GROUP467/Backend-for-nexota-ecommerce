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

export const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const linkedProducts = await Product.find(
      getBrandProductQuery(brand),
    ).select("title name slug image brand brandId brandName");

    let targetBrand = null;

    if (linkedProducts.length > 0) {
      if (req.body?.moveProductsTo) {
        if (String(req.body.moveProductsTo) === String(brand._id)) {
          return res.status(400).json({
            success: false,
            message: "Choose a different brand for reassignment",
          });
        }

        targetBrand = await Brand.findById(req.body.moveProductsTo);
      } else if (req.body?.createBrand?.name) {
        const payload = req.body.createBrand;
        const slug = payload.slug || toSlug(payload.name);
        const exists = await Brand.findOne({ slug });

        if (exists) {
          return res.status(400).json({
            success: false,
            message: "Destination brand already exists",
          });
        }

        targetBrand = await Brand.create({
          name: payload.name,
          slug,
          logo: payload.logo,
        });
      }

      if (!targetBrand) {
        const availableBrands = await Brand.find({
          _id: { $ne: brand._id },
        }).sort({ createdAt: -1 });

        return res.status(409).json({
          success: false,
          requiresReassignment: true,
          message: "This brand has products. Move them before deleting.",
          brand,
          products: linkedProducts,
          availableBrands,
        });
      }

      await Product.updateMany(getBrandProductQuery(brand), {
        $set: {
          brand: targetBrand._id,
          brandId: targetBrand._id,
          brandName: targetBrand.name,
        },
      });
    }

    await brand.deleteOne();

    res.json({
      success: true,
      message: "Brand deleted successfully",
      movedProducts: linkedProducts.length,
      destinationBrand: targetBrand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
