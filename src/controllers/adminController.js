/**
 * Admin Dashboard Controller
 * Provides comprehensive admin statistics, monitoring, and control endpoints
 */

import Order from "../models/Order.js";
import crypto from "crypto";
import AuditLog, { auditLogger } from "../models/AuditLog.js";
import { checkVendorHealth as getVendorHealthStatus } from "../services/vendorGateway.js";
import logger from "../utils/logger.js";
import { generateToken } from "../middleware/auth.js";

/**
 * Admin Login - Exchanges API Key for a Secure HttpOnly Cookie
 */
export const login = async (req, res) => {
  try {
    const { password } = req.body;
    const expectedKey = (process.env.API_KEY || "").trim();

    if (!password) {
      return res.status(401).json({ error: "Password is required" });
    }

    // Use timing-safe comparison by hashing both values to a fixed length
    const inputHash = crypto.createHash('sha256').update(password).digest();
    const expectedHash = crypto.createHash('sha256').update(expectedKey).digest();

    if (inputHash.length !== expectedHash.length || !crypto.timingSafeEqual(inputHash, expectedHash)) {
      logger.warn("Admin login attempt failed: Invalid credentials", { ip: req.ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken({ role: "admin", timestamp: Date.now() });

    const isLocal = req.hostname === "localhost" || req.hostname === "127.0.0.1";

    // Set the JWT in a secure, HttpOnly cookie
    res.cookie("admin_token", token, {
      httpOnly: true, // Prevents JS access (XSS protection)
      secure: !isLocal, // sameSite: "none" requires secure: true
      sameSite: isLocal ? "lax" : "none", // "none" allows cross-domain (Vercel to Render)
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    auditLogger.log({
      action: "admin_login",
      entity: "Admin",
      metadata: { ip: req.ip }
    });

    return res.json({ 
      success: true, 
      message: "Logged in successfully",
      token 
    });
  } catch (err) {
    logger.error("Login error", { error: err.message });
    return res.status(500).json({ error: "Authentication failed" });
  }
};

/**
 * Get comprehensive dashboard statistics
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { network, status, search } = req.query;
    const query = {};

    if (network && network !== "all" && network !== "") {
      query.network = network.toUpperCase();
    }
    if (status && status !== "all" && status !== "") {
      query.orderStatus = status;
    }
    if (search && search !== "") {
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { reference: { $regex: sanitizedSearch, $options: "i" } },
        { phone: { $regex: sanitizedSearch, $options: "i" } },
        { shortTrackingId: { $regex: sanitizedSearch, $options: "i" } },
        { vendorReference: { $regex: sanitizedSearch, $options: "i" } }
      ];
    }

    // Overall stats - Adjusted to count both successful and failed transactions
    const totalRaw = await Order.countDocuments(query); // All transaction attempts
    const total = await Order.countDocuments({ ...query, paymentStatus: { $in: ["completed", "failed"] } }); 
    
    // Successful Payments - also based on completed payment status
    const completed = await Order.countDocuments({ 
      ...query,
      paymentStatus: "completed"
    });

    const failed = await Order.countDocuments({ ...query, orderStatus: "failed" });
    const pending = await Order.countDocuments({ ...query, paymentStatus: "pending" });
    // Processing: Paid but not yet delivered or failed
    const processing = await Order.countDocuments({ ...query, paymentStatus: "completed", orderStatus: { $in: ["processing", "queued", "sent", "retrying", "pending_vendor_balance"] } });

    // Revenue = Sum of successful orders amount | Profit = Revenue - Vendor Cost
    const financialStats = await Order.aggregate([
      {
        $match: {
          ...query,
          paymentStatus: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalCost: { 
            $sum: { 
              $ifNull: [
                "$vendorCost", 
                { $multiply: ["$amount", {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$network", "MTN"] }, then: 0.88 },
                      { case: { $eq: ["$network", "TELECEL"] }, then: 0.86 },
                      { case: { $eq: ["$network", "AIRTELTIGO"] }, then: 0.84 }
                    ],
                    default: 0.87
                  }
                }]}
              ] 
            } 
          },
          avgOrderValue: { $avg: "$amount" }
        }
      }
    ]);

    const financial = financialStats[0] || { totalRevenue: 0, totalCost: 0, avgOrderValue: 0 };
    const profit = financial.totalRevenue - financial.totalCost;

    // Network breakdown
    const networkStats = await Order.aggregate([
      {
        $match: { paymentStatus: "completed" } // Only track performance for successful payments
      },
      {
        $group: {
          _id: "$network",
          count: { $sum: 1 },
          revenue: { $sum: "$amount" }
        }
      }
    ]);

    // Success rate
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

    // Retry statistics
    const retryStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          avgRetries: { $avg: "$retryCount" },
          maxRetries: { $max: "$retryCount" },
          ordersWithRetries: { $sum: { $cond: [{ $gt: ["$retryCount", 0] }, 1, 0] } }
        }
      }
    ]);

    const retries = retryStats[0] || { avgRetries: 0, maxRetries: 0, ordersWithRetries: 0 };

    // Vendor health
    const vendorHealth = await getVendorHealthStatus();

    // Last 24 hours performance
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24HourStats = await Order.countDocuments({
      createdAt: { $gte: last24Hours },
      paymentStatus: "completed"
    });

    return res.json({
      summary: {
        total,
        completed,
        failed,
        pending,
        processing,
        successRate: `${successRate}%`,
        last24HourOrders: last24HourStats
      },
      financial: {
        totalRevenue: financial.totalRevenue.toFixed(2),
        totalCost: financial.totalCost.toFixed(2),
        totalProfit: profit.toFixed(2),
        profitMargin: financial.totalRevenue > 0 ? ((profit / financial.totalRevenue) * 100).toFixed(2) : 0,
        avgOrderValue: financial.avgOrderValue.toFixed(2)
      },
      networks: networkStats,
      retries: {
        avgRetries: retries.avgRetries.toFixed(2),
        maxRetries: retries.maxRetries,
        ordersWithRetries: retries.ordersWithRetries
      },
      vendorHealth,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error("Dashboard stats error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
};

/**
 * Controller to handle vendor health check requests
 */
export const checkVendorHealth = async (req, res) => {
  try {
    const health = await getVendorHealthStatus();
    return res.json(health);
  } catch (err) {
    logger.error("Vendor health check controller error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch vendor health status" });
  }
};

/**
 * Get live dashboard data (for real-time updates)
 */
export const getLiveDashboard = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select("reference shortTrackingId network phone orderStatus paymentStatus vendorStatus amount createdAt vendorReference");

    // Active orders (currently processing)
    const activeOrders = await Order.find({
      orderStatus: { $in: ["processing", "sent", "pending", "retrying"] }
    })
      .sort({ processingStartedAt: -1 })
      .limit(10);

    // Failed orders needing attention
    const failedOrders = await Order.find({
      orderStatus: "failed",
      retryCount: { $lt: 4 }
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      recentOrders,
      activeOrders,
      failedOrders,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error("Live dashboard error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch live dashboard" });
  }
};

/**
 * Get detailed order information
 */
export const getOrderDetails = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: "Reference required" });
    }

    const order = await Order.findOne({ reference });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get related audit logs
    const auditLogs = await AuditLog.find({
      $or: [
        { entityId: order._id },
        { orderId: order.reference }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      order,
      auditLogs
    });
  } catch (err) {
    logger.error("Order details error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch order details" });
  }
};

/**
 * Get retry attempts for an order
 */
export const getRetryAttempts = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: "Reference required" });
    }

    const order = await Order.findOne({ reference });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get all vendor dispatch attempts from audit logs
    const attempts = await AuditLog.find({
      orderId: order.reference,
      action: { $in: ["vendor_dispatch", "vendor_dispatch_error", "retry_scheduled"] }
    })
      .sort({ createdAt: -1 });

    return res.json({
      orderId: order._id,
      reference: order.reference,
      retryCount: order.retryCount || 0,
      maxRetries: order.maxRetries || 4,
      nextRetryAt: order.nextRetryAt,
      attempts,
      orderStatus: order.orderStatus,
      vendorStatus: order.vendorStatus
    });
  } catch (err) {
    logger.error("Retry attempts error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch retry attempts" });
  }
};

/**
 * Get audit logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { 
      limit = 100, 
      page = 1, 
      action, 
      entity,
      orderId 
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (orderId) query.orderId = orderId;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await AuditLog.countDocuments(query);

    return res.json({
      logs,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    logger.error("Audit logs error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
};

/**
 * Get performance trends (last 7 days)
 */
export const getPerformanceTrends = async (req, res) => {
  try {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const trends = await Order.aggregate([
      {
        $match: { createdAt: { $gte: start } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalOrders: { $sum: { $cond: [{ $in: ["$paymentStatus", ["completed", "failed"]] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, 1, 0] } }, // Based on payment success
          failedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "failed"] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, "$amount", 0] } }, // Sum of paid amounts
          avgRetries: { $avg: "$retryCount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill gaps for days with no orders
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const trend = trends.find(t => t._id === dateStr);

      last7Days.push({
        date: dateStr,
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        totalOrders: trend?.totalOrders || 0,
        completedOrders: trend?.completedOrders || 0,
        failedOrders: trend?.failedOrders || 0,
        successRate: trend?.totalOrders ? ((trend.completedOrders / trend.totalOrders) * 100).toFixed(2) : 0,
        revenue: (trend?.revenue || 0).toFixed(2),
        avgRetries: (trend?.avgRetries || 0).toFixed(2)
      });
    }

    return res.json(last7Days);
  } catch (err) {
    logger.error("Trends error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch performance trends" });
  }
};

/**
 * Get vendor performance metrics
 */
export const getVendorMetrics = async (req, res) => {
  try {
    const vendorMetrics = await Order.aggregate([
      {
        $match: { paymentStatus: { $in: ["completed", "failed"] } }
      },
      {
        $group: {
          _id: "$network",
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, 1, 0] } }, // Based on payment success
          failedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "failed"] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, "$amount", 0] } }, // Sum of paid amounts
          avgRetries: { $avg: "$retryCount" }
        }
      },
      {
        $project: {
          _id: 1,
          totalOrders: 1,
          completedOrders: 1,
          failedOrders: 1,
          successRate: {
            $cond: [
              { $eq: ["$totalOrders", 0] },
              0,
              { $multiply: [{ $divide: ["$completedOrders", "$totalOrders"] }, 100] }
            ]
          },
          totalRevenue: 1,
          avgRetries: 1
        }
      }
    ]);

    const health = await getVendorHealthStatus();

    return res.json({
      metrics: vendorMetrics,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error("Vendor metrics error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch vendor metrics" });
  }
};

export default {
  checkVendorHealth,
  getDashboardStats,
  getLiveDashboard,
  getOrderDetails,
  getRetryAttempts,
  getAuditLogs,
  getPerformanceTrends,
  getVendorMetrics
};
