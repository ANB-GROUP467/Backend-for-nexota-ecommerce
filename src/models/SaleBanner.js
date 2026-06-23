import mongoose from "mongoose";

const saleBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: "",
    },
    ctaText: {
      type: String,
      default: "Shop Now",
    },
    placement: {
      type: String,
      enum: ["home", "deals", "products"],
      default: "home",
    },
    priority: {
      type: Number,
      default: 0,
    },
    startAt: Date,
    endAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("SaleBanner", saleBannerSchema);
