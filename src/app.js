
import express from "express";
import cors from "cors";

import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import trackingRoutes from "./routes/trackRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";
import logger from "./utils/logger.js";

const app = express();

// ==========================
// MIDDLEWARE
// ==========================
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// ==========================
// ROUTES
// ==========================
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bundles", bundleRoutes);

app.get("/api", (req, res) => {
  res.json({
    message: "Welcome to Data Bundle API",
    endpoints: {
      orders: "/api/orders",
      payments: "/api/payments",
      track: "/api/orders/track-order",
      status: "ok"
    }
  });
});

// ==========================
// 404 HANDLER
// ==========================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// ==========================
// GLOBAL ERROR HANDLER
// ==========================
app.use((err, req, res, next) => {
  logger.error("Server Error:", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  // Don't expose error details in production
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isProduction ? {} : { details: err.message })
  });
});

export default app;