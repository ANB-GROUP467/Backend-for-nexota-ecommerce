import mongoose from "mongoose";

// ── Address schema pehle — taake userSchema use kar sake ──
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    country: { type: String, default: "Qatar" },
    city: { type: String, default: "" },
    area: { type: String, default: "" },
    street: { type: String, default: "" },
    building: { type: String, default: "" },
    floor: { type: String, default: "" },
    apartment: { type: String, default: "" },
    zone: { type: String, default: "" },
    landmark: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    deliveryInstructions: { type: String, default: "" },
    latitude: { type: String, default: "" },
    longitude: { type: String, default: "" },
    mapUrl: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── User schema — addresses ab bahar (sahi jagah) ──
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    phone: {
      type: String,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },

    // ✅ Yahan hai — timestamps object ke bahar
    addresses: {
      type: [addressSchema],
      default: [],
    },
  },
  { timestamps: true }, // ✅ Sirf options — koi extra field nahi
);

export default mongoose.model("User", userSchema);
