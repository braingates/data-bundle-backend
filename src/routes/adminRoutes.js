import express from "express";
import Order from "../models/Order.js";
import { verifyApiKey } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// HANDLE PREFLIGHT REQUESTS
// ==========================================

router.options("*", (req, res) => {
  res.sendStatus(200);
});

// ==========================================
// APPLY ADMIN AUTH
// ==========================================

router.use(verifyApiKey);

// ==========================================
// ADMIN: GET ALL ORDERS
// WITH FILTERS + PAGINATION
// ==========================================

router.get("/orders", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      network,
      status
    } = req.query;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.max(parseInt(limit) || 50, 1);

    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    // ==========================================
    // SEARCH
    // ==========================================

    if (search?.trim()) {
      query.$or = [
        {
          reference: {
            $regex: search.trim(),
            $options: "i"
          }
        },
        {
          phone: {
            $regex: search.trim(),
            $options: "i"
          }
        }
      ];
    }

    // ==========================================
    // NETWORK FILTER
    // ==========================================

    if (network && network !== "all") {
      query.network = network;
    }

    // ==========================================
    // STATUS FILTER
    // ==========================================

    if (status && status !== "all") {
      query.orderStatus = status;
    }

    // ==========================================
    // FETCH ORDERS
    // ==========================================

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),

      Order.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      orders,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit)
    });

  } catch (err) {
    console.error("❌ ADMIN GET ORDERS ERROR:", err);

    res.status(500).json({
      success: false,
      error: "Failed to fetch orders"
    });
  }
});

// ==========================================
// ADMIN: DASHBOARD STATS
// ==========================================

router.get("/dashboard/stats", async (req, res) => {
  try {

    // ==========================================
    // TOTAL ORDERS
    // ==========================================

    const totalOrders = await Order.countDocuments();

    // ==========================================
    // SUCCESSFUL ORDERS
    // ==========================================

    const completedOrders = await Order.countDocuments({
      $or: [
        { vendorStatus: "success" },
        { orderStatus: "completed" }
      ]
    });

    // ==========================================
    // FAILED ORDERS
    // ==========================================

    const failedOrders = await Order.countDocuments({
      $or: [
        { vendorStatus: "failed" },
        { orderStatus: "failed" }
      ]
    });

    // ==========================================
    // FINANCIAL AGGREGATION
    // ==========================================

    const financialStats = await Order.aggregate([
      {
        $match: {
          $or: [
            { vendorStatus: "success" },
            { orderStatus: "completed" }
          ]
        }
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: {
              $ifNull: ["$amount", 0]
            }
          },

          totalVendorCost: {
            $sum: {
              $ifNull: ["$vendorCost", 0]
            }
          }
        }
      }
    ]);

    const revenue =
      financialStats[0]?.totalRevenue || 0;

    const vendorCost =
      financialStats[0]?.totalVendorCost || 0;

    const profit = revenue - vendorCost;

    // ==========================================
    // RESPONSE
    // ==========================================

    res.status(200).json({
      success: true,

      summary: {
        total: totalOrders,
        completed: completedOrders,
        failed: failedOrders
      },

      financial: {
        totalRevenue: revenue,
        totalVendorCost: vendorCost,
        totalProfit: profit
      }
    });

  } catch (err) {
    console.error("❌ ADMIN STATS ERROR:", err);

    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard stats"
    });
  }
});

// ==========================================
// ADMIN: PERFORMANCE TRENDS
// ==========================================

router.get("/dashboard/trends", async (req, res) => {
  try {

    const trends = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            )
          }
        }
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },

          revenue: {
            $sum: {
              $ifNull: ["$amount", 0]
            }
          },

          profit: {
            $sum: {
              $subtract: [
                { $ifNull: ["$amount", 0] },
                { $ifNull: ["$vendorCost", 0] }
              ]
            }
          }
        }
      },

      {
        $sort: {
          _id: 1
        }
      }
    ]);

    const formatted = trends.map(item => ({
      label: item._id,
      revenue: item.revenue,
      profit: item.profit
    }));

    res.status(200).json(formatted);

  } catch (err) {
    console.error("❌ ADMIN TRENDS ERROR:", err);

    res.status(500).json({
      success: false,
      error: "Failed to fetch trends"
    });
  }
});

// ==========================================
// ADMIN: VENDOR HEALTH
// ==========================================

router.get("/vendors/health", async (req, res) => {
  try {

    const health = {
      MTN: {
        status: "online"
      },

      Telecel: {
        status: "online"
      },

      AirtelTigo: {
        status: "online"
      }
    };

    res.status(200).json(health);

  } catch (err) {
    console.error("❌ VENDOR HEALTH ERROR:", err);

    res.status(500).json({
      success: false,
      error: "Failed to fetch vendor health"
    });
  }
});

export default router;
