import express from "express";
import Order from "../models/Order.js";
import { syncOrderStatus } from "../services/syncEngine.js";
import { getOrders } from "../controllers/orderController.js";

const router = express.Router();

// Public route for general order search (customer-facing)
router.get("/", getOrders);

router.post("/track-order", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const order = await Order.findOne({
      $or: [{ reference: query }, { phone: query }]
    }).sort({ createdAt: -1 });

    if (order && ["processing", "sent", "pending"].includes(order.orderStatus)) {
      await syncOrderStatus(order).catch(() => {});
      return res.json(await Order.findById(order._id));
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      reference: order.reference,
      shortTrackingId: order.shortTrackingId,
      phone: order.phone,
      network: order.network,
      bundle: order.bundle,
      amount: order.amount,
      paymentStatus: order.paymentStatus,
      vendorReference: order.vendorReference,
      vendorStatus: order.vendorStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt
    });
  } catch (err) {
    console.error("TRACK ERROR:", err);
    return res.status(500).json({ error: "Server error while tracking order" });
  }
});

router.get("/:reference", async (req, res) => {
  try {
    const order = await Order.findOne({
      reference: req.params.reference
    });

    if (order && ["processing", "sent", "pending"].includes(order.orderStatus)) {
      await syncOrderStatus(order).catch(() => {});
      return res.json(await Order.findById(order._id));
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(order);
  } catch (err) {
    console.error("TRACK GET ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;