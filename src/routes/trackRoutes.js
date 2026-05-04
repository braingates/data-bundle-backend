import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

// ==========================
// TRACK ORDER (PHONE OR REFERENCE)
// ==========================
router.post("/track-order", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Query is required"
      });
    }

    const order = await Order.findOne({
      $or: [
        { reference: query },
        { phone: query }
      ]
    }).sort({ createdAt: -1 }); // return latest if multiple

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
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

    return res.status(500).json({
      error: "Server error while tracking order"
    });
  }
});

// ==========================
// TRACK BY REFERENCE (USED BY POLLING)
// ==========================
router.get("/:reference", async (req, res) => {
  try {
    const order = await Order.findOne({
      reference: req.params.reference
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    return res.json(order);

  } catch (err) {
    console.error("TRACK GET ERROR:", err);

    return res.status(500).json({
      error: "Server error"
    });
  }
});


import { verifyApiKey } from "../middleware/auth.js";

router.get("/admin/orders", verifyApiKey, async (req, res) => {
  // protected route
});



//import express from "express";
//import Order from "../models/Order.js";

//const router = express.Router();

// ==========================
// GET RECENT ORDERS BY PHONE
// ==========================
router.get("/recent/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ error: "Phone required" });
    }

    const orders = await Order.find({ phone })
      .sort({ createdAt: -1 }) // newest first
      .limit(10);

    res.json({
      success: true,
      orders
    });

  } catch (err) {
    console.error("Fetch orders error:", err.message);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

//export default router;
export default router;