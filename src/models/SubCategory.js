import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sub-category name is required"],
      trim: true,
    },

    slug: {
      type: String,
      required: [true, "Sub-category slug is required"],
      trim: true,
      lowercase: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Parent category is required"],
      index: true,
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Same slug can exist in different categories,
// but cannot repeat inside the same category.
subCategorySchema.index(
  {
    category: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

export default mongoose.model("SubCategory", subCategorySchema);
