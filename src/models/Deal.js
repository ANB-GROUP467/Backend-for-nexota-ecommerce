import mongoose from "mongoose";

const dealItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false },
);

const dealSchema = new mongoose.Schema(
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
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    products: {
      type: [dealItemSchema],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Deal must have at least one product",
      },
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    dealPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    sold: {
      type: Number,
      default: 0,
      min: 0,
    },

    badge: {
      type: String,
      default: "Deal",
    },

    featured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
    },

    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true },
);

dealSchema.virtual("discountPercent").get(function () {
  if (!this.originalPrice || this.originalPrice <= this.dealPrice) return 0;
  return Math.round(
    ((this.originalPrice - this.dealPrice) / this.originalPrice) * 100,
  );
});

dealSchema.set("toJSON", { virtuals: true });
dealSchema.set("toObject", { virtuals: true });

export default mongoose.model("Deal", dealSchema);
