/*
// adminRoutes.js - REMOVE DUPLICATE ROUTE
import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js";

const router = express.Router();

// ==========================
// STATS
// ==========================
router.get("/stats", async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const success = await Order.countDocuments({ vendorStatus: "success" });
    const revenueData = await Order.find({ paymentStatus: "completed" });
    const revenue = revenueData.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    res.json({ total, success, revenue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// ORDERS (FILTERABLE) - PROTECTED
// ==========================
router.get("/orders", verifyApiKey, async (req, res) => {
  try {
    const { page = 1, limit = 50, network, status, search } = req.query;
    const query = {};

    if (network) query.network = network;
    if (status) query.vendorStatus = status;
    if (search) {
      query.$or = [
        { reference: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

*/

import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js";

const router = express.Router();

// ==========================
// STATS (FIXED LOGIC)
// ==========================
router.get("/stats", async (req, res) => {
  try {
    const total = await Order.countDocuments();

    const success = await Order.countDocuments({
      orderStatus: "completed"
    });

    const failed = await Order.countDocuments({
      orderStatus: "failed"
    });

    const revenueData = await Order.find({
      paymentStatus: "completed",
      orderStatus: "completed"
    });

    const revenue = revenueData.reduce(
      (sum, o) => sum + (Number(o.amount) || 0),
      0
    );

    res.json({
      total,
      success,
      failed,
      revenue
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// ORDERS (FIXED FILTERING)
// ==========================
router.get("/orders", verifyApiKey, async (req, res) => {
  try {

    const {
      page = 1,
      limit = 50,
      network,
      status,
      search
    } = req.query;

    const query = {};

    if (network) query.network = network;

    // FIX: map admin status to correct field
    if (status && status !== "all") {
      query.orderStatus = status;
    }

    if (search) {
      query.$or = [
        {
          reference: new RegExp(search, "i")
        },
        {
          phone: new RegExp(search, "i")
        }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error("ADMIN ORDERS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;