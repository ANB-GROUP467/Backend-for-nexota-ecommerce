import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import Brand from "../models/Brand.js";
import cloudinary from "../config/cloudnary.js";

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeImages = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);

  if (typeof images === "string") {
    const trimmed = images.trim();

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }

    return trimmed
      .split(",")
      .map((image) => image.trim())
      .filter(Boolean);
  }

  return [];
};

const parseStructuredValue = (value, fallback) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
};

const normalizeVariant = (variant = {}) => {
  const color =
    typeof variant.color === "string"
      ? { name: variant.color, hex: variant.colorHex || "" }
      : {
          name: variant.color?.name || "",
          hex: variant.color?.hex || "",
        };

  return {
    ...variant,
    sku: String(variant.sku || "")
      .trim()
      .toUpperCase(),
    version: String(variant.version || "").trim(),
    color,
    storage: String(variant.storage || "").trim(),
    ram: String(variant.ram || "").trim(),
    price: Number(variant.price || 0),
    oldPrice: Number(variant.oldPrice || 0),
    stock: Number(variant.stock || 0),
    images: normalizeImages(variant.images),
    isActive:
      variant.isActive === undefined ? true : parseBoolean(variant.isActive),
    attributes:
      parseStructuredValue(variant.attributes, {}) || variant.attributes || {},
  };
};

const buildProductPayload = (body, uploadedImages = []) => {
  const payload = { ...body };

  if (body.variants !== undefined) {
    const variants = parseStructuredValue(body.variants, []);
    payload.variants = Array.isArray(variants)
      ? variants.map(normalizeVariant)
      : [];
  }

  if (body.specifications !== undefined) {
    const specifications = parseStructuredValue(body.specifications, []);
    payload.specifications = Array.isArray(specifications)
      ? specifications
      : [];
  }

  ["featured", "recommended", "bestSeller"].forEach((field) => {
    if (body[field] !== undefined) payload[field] = parseBoolean(body[field]);
  });

  ["price", "oldPrice", "stock", "rating", "reviewsCount"].forEach((field) => {
    if (body[field] !== undefined && body[field] !== "") {
      payload[field] = Number(body[field]);
    }
  });

  if (uploadedImages.length > 0) {
    payload.images = uploadedImages;
  } else if (body.images !== undefined) {
    payload.images = normalizeImages(body.images);
  }

  return payload;
};

const resolveRefId = async (Model, value) => {
  if (!value) return null;
  if (isObjectId(value)) return value;

  const safeValue = escapeRegex(value);
  const doc = await Model.findOne({
    $or: [
      { slug: value },
      { name: value },
      { title: value },
      { slug: { $regex: `^${safeValue}$`, $options: "i" } },
      { name: { $regex: `^${safeValue}$`, $options: "i" } },
      { title: { $regex: `^${safeValue}$`, $options: "i" } },
    ],
  }).select("_id");

  return doc?._id || null;
};

const addNoMatchCondition = (query) => {
  query._id = new mongoose.Types.ObjectId("000000000000000000000000");
};

const buildProductQuery = async (queryParams) => {
  const {
    category,
    subCategory,
    subcategory,
    brand,
    search,
    keyword,
    minPrice,
    maxPrice,
    rating,
    featured,
    recommended,
    bestSeller,
    status,
  } = queryParams;

  const query = {
    status: status || { $ne: "inactive" },
  };

  if (category) {
    const id = await resolveRefId(Category, category);
    if (id) query.category = id;
    else addNoMatchCondition(query);
  }

  const subCategoryValue = subCategory || subcategory;
  if (subCategoryValue) {
    const id = await resolveRefId(SubCategory, subCategoryValue);
    if (id) query.subCategory = id;
    else addNoMatchCondition(query);
  }

  if (brand) {
    const id = await resolveRefId(Brand, brand);
    if (id) query.brand = id;
    else addNoMatchCondition(query);
  }

  const text = search || keyword;
  if (text) {
    const safeText = escapeRegex(text);
    query.$or = [
      { title: { $regex: safeText, $options: "i" } },
      { description: { $regex: safeText, $options: "i" } },
      { "variants.sku": { $regex: safeText, $options: "i" } },
      { "variants.version": { $regex: safeText, $options: "i" } },
      { "variants.color.name": { $regex: safeText, $options: "i" } },
      { "variants.storage": { $regex: safeText, $options: "i" } },
      { "variants.ram": { $regex: safeText, $options: "i" } },
    ];
  }

  if (rating) query.rating = { $gte: Number(rating) };

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (featured !== undefined) query.featured = parseBoolean(featured);
  if (recommended !== undefined) query.recommended = parseBoolean(recommended);
  if (bestSeller !== undefined) query.bestSeller = parseBoolean(bestSeller);

  return query;
};

const buildSortOption = (sort) => {
  switch (sort) {
    case "low-high":
    case "price-low":
      return { price: 1 };
    case "high-low":
    case "price-high":
      return { price: -1 };
    case "rating":
      return { rating: -1, reviewsCount: -1 };
    case "oldest":
      return { createdAt: 1 };
    default:
      return { createdAt: -1 };
  }
};

const populateProductRefs = (query) =>
  query.populate("category").populate("subCategory").populate("brand");

const uploadFiles = async (files = []) => {
  const uploadedImages = [];

  for (const file of files) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "nexota/products",
    });
    uploadedImages.push(result.secure_url);
  }

  return uploadedImages;
};

export const createProduct = async (req, res) => {
  try {
    const uploadedImages = req.files?.length
      ? await uploadFiles(req.files)
      : [];
    const product = await Product.create(
      buildProductPayload(req.body, uploadedImages),
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
      product,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const skip = (page - 1) * limit;
    const query = await buildProductQuery(req.query);

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      populateProductRefs(Product.find(query))
        .sort(buildSortOption(req.query.sort))
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      data: products,
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit) || 1,
        totalProducts,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await populateProductRefs(Product.findById(req.params.id));
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.json({ success: true, data: product, product });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || req.params.id || "").toLowerCase();
    const product = await populateProductRefs(Product.findOne({ slug }));

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.json({ success: true, data: product, product });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const searchProducts = async (req, res) => {
  req.query.search =
    req.params.keyword || req.query.search || req.query.keyword;
  return getProducts(req, res);
};

export const filterProducts = getProducts;

export const updateProduct = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const uploadedImages = req.files?.length
      ? await uploadFiles(req.files)
      : [];
    const payload = buildProductPayload(req.body, uploadedImages);

    Object.assign(product, payload);
    await product.save();

    return res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
      product,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedProducts = async (req, res) => {
  req.query.featured = "true";
  return getProducts(req, res);
};

export const getBestSellerProducts = async (req, res) => {
  req.query.bestSeller = "true";
  return getProducts(req, res);
};

export const getAllProducts = getProducts;
export const getProduct = getProductById;
export const getSingleProduct = getProductById;
export const getSingleProductBySlug = getProductBySlug;
