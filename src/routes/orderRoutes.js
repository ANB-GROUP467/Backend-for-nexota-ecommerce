import express from "express";

import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
} from "../controllers/orderController.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/my-orders", getOrders);

router.get("/:id", getOrderById);
router.put("/:id", updateOrder);
router.patch("/:id", updateOrder);
router.patch("/:id/status", updateOrderStatus);
router.put("/:id/cancel", cancelOrder);
router.patch("/:id/cancel", cancelOrder);
router.delete("/:id", deleteOrder);

export default router;
