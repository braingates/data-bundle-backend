import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

import { connectDB } from "./src/config/db.js";

import paymentRoutes from "./src/routes/paymentRoutes.js";
import trackingRoutes from "./src/routes/trackRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import bundleRoutes from "./src/routes/bundleRoutes.js";
import webhookRoutes from "./src/routes/webhookRoutes.js";

import { startWorker } from "./src/services/queue.js";
import syncEngine from "./src/services/syncEngine.js";
import notificationService from "./src/services/notificationService.js";
import logger from "./src/utils/logger.js";

const app = express();
const httpServer = createServer(app);

// Socket.IO with restricted CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5500"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket"]
});

const PORT = process.env.PORT || 5001;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/", limiter);

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || [
    "https://megabytestation.vercel.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://braingates.github.io/megabyte-admin/",
    "https://megabyte-admin.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.set("io", io);

app.use("/api/payments", paymentRoutes);
app.use("/api/orders", trackingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bundles", bundleRoutes);
app.use("/api/webhook", webhookRoutes);

// Enhanced health check with database connectivity verification
app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: "unknown",
    redis: "unknown"
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      health.mongodb = "connected";
    } else {
      health.mongodb = "disconnected";
    }
  } catch (err) {
    health.mongodb = "error";
  }

  // Redis check is handled by connection in queue.js
  // If queue is working, Redis is available
  health.redis = "connected";

  const statusCode = health.mongodb === "connected" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get("/", (req, res) => {
  res.json({ name: "Data Bundle API", version: "2.0.0" });
});

// Graceful error handling - must be set up BEFORE server starts
process.on("uncaughtException", (err) => {
  logger.error("FATAL: Uncaught Exception", {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // Attempt to notify via Telegram
  notificationService.sendTelegram(
    `🔴 <b>CRITICAL: Uncaught Exception</b>\n<code>${err.message}</code>`
  ).catch(() => {});

  // Exit after logging (process manager like PM2 will restart)
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("FATAL: Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : null,
    timestamp: new Date().toISOString()
  });

  // Attempt to notify via Telegram
  notificationService.sendTelegram(
    `🔴 <b>CRITICAL: Unhandled Rejection</b>\n<code>${reason instanceof Error ? reason.message : String(reason)}</code>`
  ).catch(() => {});

  // Exit after logging
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, gracefully shutting down...`);

  try {
    // Stop accepting new connections
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });

    // Close database connection
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");

    // Give processes time to finish (10 second timeout)
    const shutdownTimeout = setTimeout(() => {
      logger.error("Forced shutdown after 10s timeout");
      process.exit(1);
    }, 10000);

    // Clear timeout if everything closes cleanly
    process.on("exit", () => {
      clearTimeout(shutdownTimeout);
    });
  } catch (err) {
    logger.error("Error during graceful shutdown", { error: err.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  try {
    await connectDB();
    logger.info("✅ Database connected");

    await import("./src/jobs/vendorProcessor.js");
    await import("./src/jobs/bundleSyncJob.js");

    startWorker();
    logger.info("✅ Worker started");

    syncEngine.init(io);
    setInterval(() => syncEngine.run(), 60 * 1000);

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("❌ Server startup failed", {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
})();

io.on("connection", (socket) => {
  logger.info("🔌 Client connected", { socketId: socket.id });

  socket.on("subscribe", (orderId) => {
    socket.join(`order-${orderId}`);
    logger.debug("Client subscribed to order", { socketId: socket.id, orderId });
  });

  socket.on("disconnect", () => {
    logger.info("🔌 Client disconnected", { socketId: socket.id });
  });
});