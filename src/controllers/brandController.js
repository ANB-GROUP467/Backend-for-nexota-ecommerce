import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Product from "../models/Product.js";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Products may store brand as ObjectId OR as a plain string (name/slug).
// We query both safely — ObjectId fields via $in with ObjectId,
// string-only fields (brandName, brandTitle, brand_slug) via string match.
// The "brand" path itself can hold either, so we pass both types for it.
const getBrandProductQuery = (brand) => {
  const objectId = new mongoose.Types.ObjectId(brand._id);
  return {
    $or: [
      { brand: objectId }, // brand stored as ObjectId ref
      { brand: String(brand._id) }, // brand stored as id string
      { brand: brand.slug }, // brand stored as slug string
      { brand: brand.name }, // brand stored as name string
      { brandId: objectId },
      { brandId: String(brand._id) },
      { brand_id: objectId },
      { brand_id: String(brand._id) },
      { brandName: brand.name },
      { brandTitle: brand.name },
      { brand_slug: brand.slug },
    ],
  };
};

// Run the query safely — if Mongoose throws a CastError (mixed schema),
// fall back to a raw collection query that bypasses schema casting.
const findLinkedProducts = async (brand) => {
  try {
    return await Product.find(getBrandProductQuery(brand)).select("_id");
  } catch {
    // Fallback: use native driver to avoid CastError on mixed-type fields
    const objectId = new mongoose.Types.ObjectId(brand._id);
    const raw = await Product.collection
      .find({
        $or: [
          { brand: objectId },
          { brand: String(brand._id) },
          { brand: brand.slug },
          { brand: brand.name },
          { brandName: brand.name },
          { brandTitle: brand.name },
          { brand_slug: brand.slug },
        ],
      })
      .project({ _id: 1 })
      .toArray();
    return raw;
  }
};

const updateLinkedProducts = async (brand, targetBrandId) => {
  const objectId = new mongoose.Types.ObjectId(brand._id);
  const targetObjectId = new mongoose.Types.ObjectId(targetBrandId);

  try {
    await Product.updateMany(getBrandProductQuery(brand), {
      $set: { brand: targetObjectId },
    });
  } catch {
    // Fallback: native driver update to bypass CastError
    await Product.collection.updateMany(
      {
        $or: [
          { brand: objectId },
          { brand: String(brand._id) },
          { brand: brand.slug },
          { brand: brand.name },
          { brandName: brand.name },
          { brandTitle: brand.name },
          { brand_slug: brand.slug },
        ],
      },
      { $set: { brand: targetObjectId } },
    );
  }
};

export const createBrand = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      slug: req.body.slug || toSlug(req.body.name),
    };
    const brand = await Brand.create(payload);
    res.status(201).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 });
    res.json({ success: true, brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res.json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!brand)
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    res.json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid brand id" });
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    }

    const body = req.body && Object.keys(req.body).length > 0 ? req.body : {};
    const moveProductsTo =
      body.moveProductsTo || req.query.moveProductsTo || null;
    const createBrandPayload = body.createBrand || null;

    console.log("deleteBrand:", {
      id,
      moveProductsTo,
      hasCreateBrand: !!createBrandPayload,
    });

    const linkedProducts = await findLinkedProducts(brand);
    console.log("Linked products:", linkedProducts.length);

    if (linkedProducts.length > 0) {
      let targetBrandId = moveProductsTo || null;

      if (createBrandPayload?.name) {
        const created = await Brand.create({
          name: createBrandPayload.name,
          slug: createBrandPayload.slug || toSlug(createBrandPayload.name),
          logo: createBrandPayload.logo || "",
        });
        targetBrandId = String(created._id);
      }

      if (!targetBrandId || !mongoose.Types.ObjectId.isValid(targetBrandId)) {
        return res.status(400).json({
          success: false,
          message:
            "This brand has linked products. Provide moveProductsTo or createBrand before deleting.",
          linkedCount: linkedProducts.length,
        });
      }

      const targetBrand = await Brand.findById(targetBrandId);
      if (!targetBrand) {
        return res
          .status(404)
          .json({ success: false, message: "Target brand not found" });
      }

      await updateLinkedProducts(brand, targetBrandId);
    }

    await Brand.findByIdAndDelete(id);

    return res
      .status(200)
      .json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    console.error("Delete brand error:", error.name, error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Delete brand failed",
      errorType: error.name,
    });
  }
};
