import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js"; // Assuming this middleware exists

const router = express.Router();

// ==========================
// ADMIN: GET ALL ORDERS (with filters and pagination)
// ==========================
router.get("/orders", verifyApiKey, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, network, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (network && network !== "all") {
      query.network = network;
    }
    if (status && status !== "all") {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(query);

    res.json({
      orders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / parseInt(limit)),
      totalOrders,
    });
  } catch (err) {
    console.error("ADMIN GET ORDERS ERROR:", err);
    res.status(500).json({ error: "Server error fetching orders" });
  }
});

// ==========================
// ADMIN: GET STATS (including profit)
// ==========================
router.get("/stats", verifyApiKey, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const successfulOrders = await Order.countDocuments({
      $or: [{ vendorStatus: "success" }, { orderStatus: "completed" }],
    });

    const revenueResult = await Order.aggregate([
      {
        $match: {
          $or: [{ vendorStatus: "success" }, { orderStatus: "completed" }],
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalCost: { $sum: "$vendorCost" }, // Sum vendorCost
        },
      },
    ]);

    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const totalCost = revenueResult[0]?.totalCost || 0;
    const totalProfit = totalRevenue - totalCost; // Calculate profit

    res.json({
      total: totalOrders,
      success: successfulOrders,
      revenue: totalRevenue.toFixed(2),
      profit: totalProfit.toFixed(2), // Add profit to stats
    });
  } catch (err) {
    console.error("ADMIN GET STATS ERROR:", err);
    res.status(500).json({ error: "Server error fetching stats" });
  }
});

export default router;