import express from "express";
import * as adminController from "../controllers/adminController.js";
import { verifyApiKey } from "../middleware/auth.js";

const router = express.Router();

// Protect all admin routes with API key verification
router.use(verifyApiKey);

// Dashboard Statistics
router.get("/dashboard/stats", adminController.getDashboardStats);
router.get("/dashboard/live", adminController.getLiveDashboard);
router.get("/dashboard/trends", adminController.getPerformanceTrends);
router.get("/dashboard/vendor-metrics", adminController.getVendorMetrics);

// Order Management
router.get("/orders", adminController.getOrders);
router.get("/orders/:reference", adminController.getOrderDetails);
router.get("/orders/:reference/retries", adminController.getRetryAttempts);

// Audit & Logging
router.get("/audit-logs", adminController.getAuditLogs);

// Vendor Health
router.get("/vendors/health", async (req, res) => {
  try {
    const { checkVendorHealth } = await import("../services/vendorGateway.js");
    const health = await checkVendorHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vendor health", code: "VENDOR_HEALTH_ERROR" });
  }
});

export default router;