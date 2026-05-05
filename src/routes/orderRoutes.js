// orderRoutes.js
import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js";

const router = express.Router();

// ==========================
// GET ORDERS BY PHONE (RECENT)
// ==========================
router.get("/recent/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    const orders = await Order.find({ phone })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(orders);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================
// ADMIN: GET ALL ORDERS
// ==========================
router.get("/admin/orders", verifyApiKey, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;