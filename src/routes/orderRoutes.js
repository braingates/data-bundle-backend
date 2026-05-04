import express from "express";
import { createPayment } from "../controllers/paymentController.js";


const router = express.Router();

// ❌ REMOVE /api/payments here (already mounted in app.js)
router.post("/create", createPayment);
//import express from "express";
import Order from "../Order.js";



// ==========================
// TRACK ORDER (PHONE OR REF)
// ==========================
// GET recent orders by phone
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

import { verifyApiKey } from "../../middleware/auth.js";

router.get("/admin/orders", verifyApiKey, async (req, res) => {
  // protected route
});