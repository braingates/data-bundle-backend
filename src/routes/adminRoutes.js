import express from "express";
import { verifyJwt } from "../middleware/auth.js";
import { login, getDashboardStats, getPerformanceTrends, checkVendorHealth } from "../controllers/adminController.js";
import { getOrders } from "../controllers/orderController.js";

const router = express.Router();

// Public login route
router.post("/login", login);

// Admin Dashboard Routes (all require JWT authentication)
router.get("/dashboard/stats", verifyJwt, getDashboardStats);
router.get("/dashboard/trends", verifyJwt, getPerformanceTrends);
router.get("/vendors/health", verifyJwt, checkVendorHealth);

// Admin Orders Route
router.get("/orders", verifyJwt, getOrders);

export default router;