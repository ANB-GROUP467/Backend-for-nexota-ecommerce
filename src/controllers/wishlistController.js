import mongoose from "mongoose";
import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";

const sendSuccess = (
  res,
  { statusCode = 200, message = "Success", data = null, extra = {} } = {},
) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });

const sendError = (
  res,
  { statusCode = 500, message = "Server error", error = null } = {},
) => {
  const payload = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV !== "production" && error?.message) {
    payload.error = error.message;
  }

  return res.status(statusCode).json(payload);
};

const getUserId = (req) => req.user?._id || req.user?.id;

const normalizeProductId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const populateWishlist = (query) =>
  query.populate({
    path: "product",
    populate: [
      { path: "category", select: "name title slug" },
      { path: "brand", select: "name title slug logo" },
      { path: "subCategory", select: "name title slug" },
    ],
  });

const formatWishlist = (rows) => rows.map((row) => row.product).filter(Boolean);

const getWishlistRows = async (userId) =>
  populateWishlist(Wishlist.find({ user: userId }).sort({ createdAt: -1 }));

export const getWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    const rows = await getWishlistRows(userId);
    const wishlist = formatWishlist(rows);

    return sendSuccess(res, {
      message: "Wishlist fetched",
      data: wishlist,
      extra: { wishlist, items: wishlist },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch wishlist", error });
  }
};

export const addToWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = normalizeProductId(
      req.body.productId || req.body.product,
    );

    if (!userId) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendError(res, { statusCode: 400, message: "Invalid product id" });
    }

    const productExists = await Product.exists({ _id: productId });

    if (!productExists) {
      return sendError(res, { statusCode: 404, message: "Product not found" });
    }

    await Wishlist.findOneAndUpdate(
      { user: userId, product: productId },
      { user: userId, product: productId },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const rows = await getWishlistRows(userId);
    const wishlist = formatWishlist(rows);

    return sendSuccess(res, {
      statusCode: 201,
      message: "Added to wishlist",
      data: wishlist,
      extra: { wishlist, items: wishlist },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to add wishlist item", error });
  }
};

export const removeFromWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = normalizeProductId(
      req.params.productId ||
        req.params.id ||
        req.body.productId ||
        req.body.product,
    );

    if (!userId) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendError(res, { statusCode: 400, message: "Invalid product id" });
    }

    await Wishlist.findOneAndDelete({ user: userId, product: productId });

    const rows = await getWishlistRows(userId);
    const wishlist = formatWishlist(rows);

    return sendSuccess(res, {
      message: "Removed from wishlist",
      data: wishlist,
      extra: { wishlist, items: wishlist, removedProductId: productId },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to remove wishlist item", error });
  }
};

export const clearWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    await Wishlist.deleteMany({ user: userId });

    return sendSuccess(res, {
      message: "Wishlist cleared",
      data: [],
      extra: { wishlist: [], items: [] },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to clear wishlist", error });
  }
};
