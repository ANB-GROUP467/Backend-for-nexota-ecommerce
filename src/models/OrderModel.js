import mongoose from "mongoose";

const selectedOptionsSchema = new mongoose.Schema(
  {
    version: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    storage: { type: String, default: "", trim: true },
    ram: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variantSku: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    selectedOptions: {
      type: selectedOptionsSchema,
      default: () => ({}),
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
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
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    zone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItems: {
      type: [orderItemSchema],
      validate: {
        validator(items) {
          return items.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },
    shippingAddress: shippingAddressSchema,
    paymentMethod: { type: String, default: "COD", trim: true },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    taxPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "QAR", uppercase: true, trim: true },
    orderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    trackingNumber: { type: String, default: "", trim: true },
    adminNote: { type: String, default: "", trim: true },
    cancelReason: { type: String, default: "", trim: true },
    cancelledAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.pre("save", function setLifecycleDates(next) {
  if (this.isModified("orderStatus")) {
    if (this.orderStatus === "Cancelled" && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
    if (this.orderStatus === "Delivered" && !this.deliveredAt) {
      this.deliveredAt = new Date();
    }
  }
  next();
});

export default mongoose.model("Order", orderSchema);
