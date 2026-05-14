/**
 * Admin Dashboard Controller
 * Provides comprehensive admin statistics, monitoring, and control endpoints
 */

import Order from "../models/Order.js";
import AuditLog, { auditLogger } from "../models/AuditLog.js";
import { checkVendorHealth } from "../services/vendorGateway.js";
import logger from "../utils/logger.js";

/**
 * Get comprehensive dashboard statistics
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Overall stats
    const total = await Order.countDocuments();
    const completed = await Order.countDocuments({ orderStatus: "completed", paymentStatus: "completed" });
    const failed = await Order.countDocuments({ orderStatus: "failed", paymentStatus: "failed" });
    const pending = await Order.countDocuments({ paymentStatus: "pending" });
    const processing = await Order.countDocuments({ orderStatus: "processing" });

    // Revenue calculations
    const financialStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: "completed",
          orderStatus: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalCost: { $sum: { $ifNull: ["$vendorCost", 0] } },
          avgOrderValue: { $avg: "$amount" }
        }
      }
    ]);

    const financial = financialStats[0] || { totalRevenue: 0, totalCost: 0, avgOrderValue: 0 };
    const profit = financial.totalRevenue - financial.totalCost;

    // Network breakdown
    const networkStats = await Order.aggregate([
      {
        $match: { orderStatus: "completed", paymentStatus: "completed" }
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
    const vendorHealth = await checkVendorHealth();

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
 * Get live dashboard data (for real-time updates)
 */
export const getLiveDashboard = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select("reference network phone orderStatus paymentStatus vendorStatus amount createdAt");

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
 * Get multiple orders with pagination and filtering
 */
export const getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      network = "",
      status = "",
      search = ""
    } = req.query;

    const query = {};

    // Filter by network if provided
    if (network && network !== "all" && network !== "") {
      query.network = network.toUpperCase();
    }

    // Filter by status if provided
    if (status && status !== "all" && status !== "") {
      query.orderStatus = status;
    }

    // Search by reference or phone if provided
    if (search && search !== "") {
      // Escape regex special characters to prevent ReDoS attacks
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      query.$or = [
        { reference: { $regex: sanitizedSearch, $options: "i" } },
        { phone: { $regex: sanitizedSearch, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("reference network phone bundle amount paymentStatus vendorStatus orderStatus retryCount createdAt");

    const total = await Order.countDocuments(query);

    return res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    logger.error("Orders list error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch orders" });
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
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "completed"] }, 1, 0] } },
          failedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "failed"] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, "$amount", 0] } },
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
        revenue: trend?.revenue.toFixed(2) || "0.00",
        avgRetries: trend?.avgRetries.toFixed(2) || "0.00"
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
        $match: { paymentStatus: "completed" }
      },
      {
        $group: {
          _id: "$network",
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "completed"] }, 1, 0] } },
          failedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "failed"] }, 1, 0] } },
          totalRevenue: { $sum: "$amount" },
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

    const health = await checkVendorHealth();

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
  getDashboardStats,
  getLiveDashboard,
  getOrderDetails,
  getRetryAttempts,
  getAuditLogs,
  getPerformanceTrends,
  getVendorMetrics
};
