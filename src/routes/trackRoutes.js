import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js";
import { syncOrderStatus } from "../services/syncEngine.js";

const router = express.Router();

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
      phone: order.phone,
      network: order.network,
      bundle: order.bundle,
      amount: order.amount,
      paymentStatus: order.paymentStatus,
      vendorStatus: order.vendorStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt
    });
  } catch (err) {
    console.error("TRACK ERROR:", err);
    return res.status(500).json({ error: "Server error while tracking order" });
  }
});

router.get("/recent/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    let orders = await Order.find({ phone })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("reference phone network bundle amount paymentStatus vendorStatus orderStatus retryCount createdAt");

    const activeOrders = orders.filter(o => 
      ["processing", "sent", "pending"].includes(o.orderStatus)
    );

    if (activeOrders.length > 0) {
      await Promise.all(activeOrders.map(o => syncOrderStatus(o).catch(() => {})));
      orders = await Order.find({ phone })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("reference phone network bundle amount paymentStatus vendorStatus orderStatus retryCount createdAt");
    }

    res.json(orders);
  } catch (err) {
    console.error("RECENT ORDERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
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