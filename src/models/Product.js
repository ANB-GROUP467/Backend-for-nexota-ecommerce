import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    hex: {
      type: String,
      trim: true,
      default: "",
      match: [/^$|^#[0-9A-Fa-f]{6}$/, "Color hex must look like #1A2B3C"],
    },
  },
  { _id: false },
);

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    version: { type: String, trim: true, default: "" },
    color: { type: colorSchema, default: () => ({}) },
    storage: { type: String, trim: true, default: "" },
    ram: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    attributes: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

const specificationSchema = new mongoose.Schema(
  {
    group: { type: String, trim: true, default: "General" },
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, default: "", trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0, default: 0 },
    oldPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    defaultVariantSku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    variants: { type: [variantSchema], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    badge: { type: String, default: "", trim: true },
    featured: { type: Boolean, default: false },
    recommended: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
    },
    specifications: { type: [specificationSchema], default: [] },
  },
  { timestamps: true },
);

const normalizeOption = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

// ─── Use async pre-hook (no next callback) ────────────────────────────────────
// Mongoose 6+ supports async pre-hooks without a next() callback.
// Using the callback style (function(next){}) can fail when Mongoose
// detects the function has no parameters and calls it differently.
productSchema.pre("validate", async function syncVariantSummary() {
  const activeVariants = (this.variants || []).filter((v) => v.isActive);

  if (activeVariants.length === 0) return;

  const seenSkus = new Set();
  const seenCombinations = new Set();

  for (const variant of activeVariants) {
    const sku = normalizeOption(variant.sku);
    const combination = [
      normalizeOption(variant.version),
      normalizeOption(variant.color?.name),
      normalizeOption(variant.storage),
      normalizeOption(variant.ram),
    ].join("|");

    if (seenSkus.has(sku)) {
      throw new mongoose.Error.ValidatorError({
        message: `Duplicate variant SKU: ${variant.sku}`,
        path: "variants.sku",
        value: variant.sku,
      });
    }

    if (seenCombinations.has(combination)) {
      throw new mongoose.Error.ValidatorError({
        message: "Each version/color/storage/RAM combination must be unique",
        path: "variants",
        value: combination,
      });
    }

    seenSkus.add(sku);
    seenCombinations.add(combination);
  }

  let defaultVariant = activeVariants.find(
    (v) => v.sku === this.defaultVariantSku,
  );

  if (!defaultVariant) {
    defaultVariant =
      activeVariants.find((v) => Number(v.stock) > 0) || activeVariants[0];
    this.defaultVariantSku = defaultVariant.sku;
  }

  this.price = Number(defaultVariant.price || 0);
  this.oldPrice = Number(defaultVariant.oldPrice || 0);
  this.stock = activeVariants.reduce(
    (total, v) => total + Number(v.stock || 0),
    0,
  );
});

productSchema.index({ category: 1, status: 1 });
productSchema.index({ brand: 1, status: 1 });

productSchema.methods.findVariant = function findVariant({
  variantId,
  sku,
} = {}) {
  if (!this.variants?.length) return null;
  return this.variants.find((variant) => {
    if (!variant.isActive) return false;
    if (variantId && String(variant._id) === String(variantId)) return true;
    if (sku && variant.sku === String(sku).trim().toUpperCase()) return true;
    return false;
  });
};

export default mongoose.model("Product", productSchema);
