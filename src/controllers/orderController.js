import mongoose from "mongoose";
import Order from "../models/OrderModel.js";
import Product from "../models/Product.js";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const makeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sendSuccess = (
  res,
  { statusCode = 200, message = "Success", data = null, extra = {} } = {},
) => res.status(statusCode).json({ success: true, message, data, ...extra });

const sendError = (res, error, fallbackStatus = 500) =>
  res.status(error.statusCode || fallbackStatus).json({
    success: false,
    message: error.message || "Server error",
  });

const isAdmin = (user) => user?.role === "admin";
const getUserId = (user) => String(user?._id || user?.id || "");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id));

const getOrderOwnerId = (order) =>
  String(order?.user?._id || order?.user?.id || order?.user || "");

const normalizeStatus = (status) => {
  const value = String(status || "").trim();
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
    : "";
};

const VALID_STATUSES = [
  "Pending",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const canCancel = (status) =>
  ["Pending", "Processing"].includes(normalizeStatus(status));

const canDelete = (status) =>
  ["Cancelled", "Delivered"].includes(normalizeStatus(status));

const populateOrder = (query) =>
  query.populate("user", "name email phone").populate("orderItems.product");

const getProductId = (item) =>
  item?.product?._id ||
  item?.product ||
  item?.productId ||
  item?._id ||
  item?.id;

const getVariant = (product, item) => {
  const activeVariants = (product.variants || []).filter(
    (variant) => variant.isActive !== false,
  );

  if (activeVariants.length === 0) return null;

  const variantId = item.variantId || item.variant?._id || item.variant?.id;
  const variantSku = String(item.variantSku || item.sku || "")
    .trim()
    .toUpperCase();

  const variant = activeVariants.find(
    (candidate) =>
      (variantId && String(candidate._id) === String(variantId)) ||
      (variantSku && candidate.sku === variantSku),
  );

  if (!variant) {
    throw makeError(`Please select a valid variant for ${product.title}`);
  }

  return variant;
};

const getSelectedOptions = (variant) => ({
  version: variant?.version || "",
  color: variant?.color?.name || "",
  storage: variant?.storage || "",
  ram: variant?.ram || "",
});

const prepareOrderItems = async (requestedItems) => {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw makeError("Order items are required");
  }

  const normalizedItems = [];
  const stockOperations = [];

  for (const item of requestedItems) {
    const productId = getProductId(item);
    const quantity = Math.max(Number(item.quantity || item.qty || 1), 1);

    if (!isValidId(productId)) throw makeError("Invalid product in cart");

    const product = await Product.findById(productId);

    if (!product || product.status === "inactive") {
      throw makeError(
        "One of the selected products is no longer available",
        404,
      );
    }

    const variant = getVariant(product, item);
    const stock = Number(variant?.stock ?? product.stock ?? 0);

    if (stock < quantity) {
      throw makeError(
        `Only ${stock} item(s) available for ${product.title}${
          variant?.sku ? ` (${variant.sku})` : ""
        }`,
      );
    }

    const price = roundMoney(variant?.price ?? product.price);
    const oldPrice = roundMoney(variant?.oldPrice ?? product.oldPrice);
    const images = variant?.images?.length
      ? variant.images
      : product.images || [];

    normalizedItems.push({
      product: product._id,
      variantId: variant?._id || null,
      variantSku: variant?.sku || "",
      selectedOptions: getSelectedOptions(variant),
      title: product.title,
      image: images[0] || "",
      quantity,
      price,
      oldPrice,
      lineTotal: roundMoney(price * quantity),
    });

    stockOperations.push({
      product: product._id,
      variantId: variant?._id || null,
      quantity,
      title: product.title,
    });
  }

  return { normalizedItems, stockOperations };
};

const reserveOne = async (operation) => {
  const { product, variantId, quantity, title } = operation;

  const updated = variantId
    ? await Product.findOneAndUpdate(
        {
          _id: product,
          variants: {
            $elemMatch: {
              _id: variantId,
              isActive: { $ne: false },
              stock: { $gte: quantity },
            },
          },
        },
        {
          $inc: {
            "variants.$.stock": -quantity,
            stock: -quantity,
          },
        },
        { new: true },
      )
    : await Product.findOneAndUpdate(
        { _id: product, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true },
      );

  if (!updated) throw makeError(`Insufficient stock for ${title}`);
};

const restoreOne = async (operation) => {
  const { product, variantId, quantity } = operation;
  if (!product || !quantity) return;

  if (variantId) {
    await Product.updateOne(
      { _id: product, "variants._id": variantId },
      {
        $inc: {
          "variants.$.stock": quantity,
          stock: quantity,
        },
      },
    );
    return;
  }

  await Product.findByIdAndUpdate(product, { $inc: { stock: quantity } });
};

const reserveStock = async (operations) => {
  const reserved = [];

  try {
    for (const operation of operations) {
      await reserveOne(operation);
      reserved.push(operation);
    }
  } catch (error) {
    for (const operation of reserved.reverse()) await restoreOne(operation);
    throw error;
  }
};

const restoreStock = async (items) => {
  for (const item of items) {
    await restoreOne({
      product: item.product?._id || item.product,
      variantId: item.variantId,
      quantity: Number(item.quantity || 1),
    });
  }
};

const reserveExistingOrderItems = async (items) => {
  await reserveStock(
    items.map((item) => ({
      product: item.product?._id || item.product,
      variantId: item.variantId,
      quantity: Number(item.quantity || 1),
      title: item.title,
    })),
  );
};

const calculateTotals = (items) => {
  const subtotal = roundMoney(
    items.reduce((total, item) => total + Number(item.lineTotal || 0), 0),
  );
  const vatRate = Math.max(Number(process.env.VAT_RATE ?? 0.05), 0);
  const freeShippingThreshold = Math.max(
    Number(process.env.FREE_SHIPPING_THRESHOLD || 0),
    0,
  );
  const defaultShippingFee = Math.max(
    Number(process.env.DEFAULT_SHIPPING_FEE || 0),
    0,
  );
  const shippingFee =
    freeShippingThreshold > 0 && subtotal >= freeShippingThreshold
      ? 0
      : defaultShippingFee;
  const taxPrice = roundMoney(subtotal * vatRate);
  const discount = 0;
  const totalAmount = roundMoney(subtotal + shippingFee + taxPrice - discount);

  return { subtotal, shippingFee, taxPrice, discount, totalAmount };
};

export const createOrder = async (req, res) => {
  let stockOperations = [];
  let stockReserved = false;

  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) throw makeError("Not authorized", 401);

    const prepared = await prepareOrderItems(
      req.body.orderItems || req.body.items || [],
    );
    stockOperations = prepared.stockOperations;
    const totals = calculateTotals(prepared.normalizedItems);

    await reserveStock(stockOperations);
    stockReserved = true;

    const order = await Order.create({
      user: userId,
      orderItems: prepared.normalizedItems,
      shippingAddress: req.body.shippingAddress,
      paymentMethod: req.body.paymentMethod || "COD",
      orderStatus: "Pending",
      ...totals,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Order placed successfully",
      data: order,
      extra: { order },
    });
  } catch (error) {
    if (stockReserved) {
      for (const operation of [...stockOperations].reverse()) {
        await restoreOne(operation);
      }
    }
    return sendError(res, error);
  }
};

export const getOrders = async (req, res) => {
  try {
    let filter = {};

    // Temporary bypass for admin panel without protect middleware.
    // If req.user is missing, fetch all orders.
    // Later, when protect is added back, customers will only see their own orders.
    if (req.user && !isAdmin(req.user)) {
      filter = {
        user: req.user._id,
      };
    }

    const orders = await populateOrder(Order.find(filter)).sort({
      createdAt: -1,
    });

    return sendSuccess(res, {
      message: "Orders fetched successfully",
      data: orders,
      extra: {
        orders,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getOrderById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw makeError("Invalid order id");
    const order = await populateOrder(Order.findById(req.params.id));
    if (!order) throw makeError("Order not found", 404);

    if (!isAdmin(req.user) && getOrderOwnerId(order) !== getUserId(req.user)) {
      throw makeError("You cannot view this order", 403);
    }

    return sendSuccess(res, {
      message: "Order fetched successfully",
      data: order,
      extra: { order },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const applyStatusTransition = async (order, nextStatus) => {
  const oldStatus = normalizeStatus(order.orderStatus);

  if (oldStatus !== "Cancelled" && nextStatus === "Cancelled") {
    await restoreStock(order.orderItems);
  }

  if (oldStatus === "Cancelled" && nextStatus !== "Cancelled") {
    await reserveExistingOrderItems(order.orderItems);
  }

  order.orderStatus = nextStatus;
};

export const updateOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw makeError("Invalid order id");
    const order = await Order.findById(req.params.id);
    if (!order) throw makeError("Order not found", 404);

    const owner = getOrderOwnerId(order) === getUserId(req.user);
    if (!isAdmin(req.user) && !owner) {
      throw makeError("You cannot update this order", 403);
    }

    if (!isAdmin(req.user) && !canCancel(order.orderStatus)) {
      throw makeError("Only pending or processing orders can be updated");
    }

    if (isAdmin(req.user) && (req.body.orderStatus || req.body.status)) {
      const nextStatus = normalizeStatus(
        req.body.orderStatus || req.body.status,
      );
      if (!VALID_STATUSES.includes(nextStatus))
        throw makeError("Invalid order status");
      await applyStatusTransition(order, nextStatus);
    }

    if (req.body.shippingAddress) {
      const currentAddress =
        order.shippingAddress?.toObject?.() || order.shippingAddress || {};
      order.shippingAddress = {
        ...currentAddress,
        ...req.body.shippingAddress,
      };
    }

    if (req.body.paymentMethod && !isAdmin(req.user)) {
      order.paymentMethod = req.body.paymentMethod;
    }

    if (isAdmin(req.user)) {
      if (req.body.paymentStatus !== undefined) {
        order.paymentStatus = req.body.paymentStatus;
      }
      if (req.body.trackingNumber !== undefined) {
        order.trackingNumber = req.body.trackingNumber;
      }
      if (req.body.adminNote !== undefined)
        order.adminNote = req.body.adminNote;
    }

    const savedOrder = await order.save();
    return sendSuccess(res, {
      message: "Order updated successfully",
      data: savedOrder,
      extra: { order: savedOrder },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    if (!isAdmin(req.user)) throw makeError("Admin access required", 403);
    if (!isValidId(req.params.id)) throw makeError("Invalid order id");

    const order = await Order.findById(req.params.id);
    if (!order) throw makeError("Order not found", 404);

    const nextStatus = normalizeStatus(req.body.status || req.body.orderStatus);
    if (!VALID_STATUSES.includes(nextStatus))
      throw makeError("Invalid order status");

    await applyStatusTransition(order, nextStatus);
    if (req.body.trackingNumber !== undefined) {
      order.trackingNumber = req.body.trackingNumber;
    }
    if (req.body.paymentStatus !== undefined) {
      order.paymentStatus = req.body.paymentStatus;
    }

    const savedOrder = await order.save();
    return sendSuccess(res, {
      message: "Order status updated successfully",
      data: savedOrder,
      extra: { order: savedOrder },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const cancelOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw makeError("Invalid order id");
    const order = await Order.findById(req.params.id);
    if (!order) throw makeError("Order not found", 404);

    if (!isAdmin(req.user) && getOrderOwnerId(order) !== getUserId(req.user)) {
      throw makeError("You cannot cancel this order", 403);
    }

    const status = normalizeStatus(order.orderStatus);
    if (status === "Cancelled") {
      return sendSuccess(res, {
        message: "Order is already cancelled",
        data: order,
        extra: { order },
      });
    }

    if (!isAdmin(req.user) && !canCancel(status)) {
      throw makeError("Only pending or processing orders can be cancelled");
    }

    await restoreStock(order.orderItems);
    order.orderStatus = "Cancelled";
    order.cancelReason = req.body.reason || req.body.cancelReason || "";
    order.cancelledAt = new Date();

    const savedOrder = await order.save();
    return sendSuccess(res, {
      message: "Order cancelled successfully",
      data: savedOrder,
      extra: { order: savedOrder },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) throw makeError("Invalid order id");
    const order = await Order.findById(req.params.id);
    if (!order) throw makeError("Order not found", 404);

    if (!isAdmin(req.user) && getOrderOwnerId(order) !== getUserId(req.user)) {
      throw makeError("You cannot delete this order", 403);
    }

    if (!isAdmin(req.user) && !canDelete(order.orderStatus)) {
      throw makeError("Only cancelled or delivered orders can be deleted");
    }

    await order.deleteOne();
    return sendSuccess(res, {
      message: "Order deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
