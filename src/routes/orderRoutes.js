// orderRoutes.js
import express from "express";
import Order from "../models/Order.js";
    import { getOrders } from "../controllers/orderController.js"; // Import the moved getOrders
import { syncOrderStatus } from "../services/syncEngine.js";

const router = express.Router();

    // Public route for general order search (customer-facing)
    router.get("/", getOrders);

// ==========================
// GET ORDERS BY PHONE (RECENT)
// ==========================
router.get("/recent/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    let orders = await Order.find({ phone })
      .sort({ createdAt: -1 })
      .limit(10);

    // Sync active orders before returning
    const activeOrders = orders.filter(o => 
      ["processing", "pending", "retrying"].includes(o.orderStatus)
    );

    if (activeOrders.length > 0) {
      await Promise.all(activeOrders.map(o => syncOrderStatus(o).catch(() => {})));
      // Refetch to get updated statuses
      orders = await Order.find({ phone }).sort({ createdAt: -1 }).limit(10);
    }

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