import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
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
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    version: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: colorSchema,
      default: () => ({}),
    },
    storage: {
      type: String,
      trim: true,
      default: "",
    },
    ram: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true },
);

const specificationSchema = new mongoose.Schema(
  {
    group: {
      type: String,
      trim: true,
      default: "General",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

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

    images: {
      type: [String],
      default: [],
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    defaultVariantSku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    badge: {
      type: String,
      default: "",
      trim: true,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    recommended: {
      type: Boolean,
      default: false,
    },

    bestSeller: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
    },

    specifications: {
      type: [specificationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const normalizeOption = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

// ─── FIX: use next(err) instead of throw ─────────────────────────────────────
// Throwing inside a Mongoose pre-hook bypasses Express error handling and
// crashes the Node process (exit code 128) on Vercel serverless functions.
// next(err) properly routes the error to the catch block in the controller.
productSchema.pre("validate", function syncVariantSummary(next) {
  const activeVariants = (this.variants || []).filter(
    (variant) => variant.isActive,
  );

  if (activeVariants.length === 0) {
    return next();
  }

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
      return next(new Error(`Duplicate variant SKU: ${variant.sku}`));
    }

    if (seenCombinations.has(combination)) {
      return next(
        new Error("Each version/color/storage/RAM combination must be unique"),
      );
    }

    seenSkus.add(sku);
    seenCombinations.add(combination);
  }

  let defaultVariant = activeVariants.find(
    (variant) => variant.sku === this.defaultVariantSku,
  );

  if (!defaultVariant) {
    defaultVariant =
      activeVariants.find((variant) => Number(variant.stock) > 0) ||
      activeVariants[0];

    this.defaultVariantSku = defaultVariant.sku;
  }

  this.price = Number(defaultVariant.price || 0);
  this.oldPrice = Number(defaultVariant.oldPrice || 0);

  this.stock = activeVariants.reduce(
    (total, variant) => total + Number(variant.stock || 0),
    0,
  );

  return next();
});

// ─── FIX: removed unique sparse index on variants.sku ────────────────────────
// A sparse unique index on an array subdocument field causes E11000 duplicate
// key errors when multiple products have no variants (all have sku: ""), or
// when variants share SKUs across different products unintentionally.
// SKU uniqueness is already enforced above in the pre-validate hook per product.
productSchema.index({ category: 1, status: 1 });
productSchema.index({ brand: 1, status: 1 });

productSchema.methods.findVariant = function findVariant({
  variantId,
  sku,
} = {}) {
  if (!this.variants?.length) return null;

  return this.variants.find((variant) => {
    if (!variant.isActive) return false;

    if (variantId && String(variant._id) === String(variantId)) {
      return true;
    }

    if (sku && variant.sku === String(sku).trim().toUpperCase()) {
      return true;
    }

    return false;
  });
};

export default mongoose.model("Product", productSchema);
