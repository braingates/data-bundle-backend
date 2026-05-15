import dotenv from "dotenv";

// Load environment variables from a single .env file
dotenv.config();
console.log("✅ Environment variables loaded from .env");

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

import { startWorker } from "./src/services/worker.js";
import syncEngine from "./src/services/syncEngine.js";
import reconciliationService from "./src/services/reconciliationService.js";
import notificationService from "./src/services/notificationService.js";
import logger from "./src/utils/logger.js";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5001;

// ==========================================
// ALLOWED ORIGINS
// ==========================================

const allowedOrigins = [
  "https://megabyte-admin.vercel.app",
  "https://megabytestation.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000"
];

// Add env origins safely
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  allowedOrigins.push(...envOrigins);
}

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

logger.info("✅ Allowed Origins Loaded", {
  origins: uniqueOrigins
});

// ==========================================
// SOCKET.IO
// ==========================================

const io = new Server(httpServer, {
  cors: {
    origin: uniqueOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// ==========================================
// SECURITY
// ==========================================

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

// ==========================================
// CORS FIX
// ==========================================

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without origin
    // Postman, mobile apps, curl, server-to-server
    if (!origin) {
      return callback(null, true);
    }

    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn("❌ CORS Blocked", { origin });

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "x-api-key"
  ],

  credentials: true,

  optionsSuccessStatus: 200,
  
  maxAge: 86400
};

// Apply CORS BEFORE routes
app.use(cors(corsOptions));

// Explicit preflight handling
app.options("*", cors(corsOptions));

// ==========================================
// RATE LIMITER (Must be after CORS)
// ==========================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", limiter);

// ==========================================
// REQUEST TIMEOUT MIDDLEWARE
// ==========================================

// ✅ HIGH FIX: Add global request timeout to prevent hanging requests
app.use((req, res, next) => {
  // Set a 30-second timeout for all requests
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  req.on("timeout", () => {
    logger.error("Request timeout", {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip
    });
    res.status(503).json({ error: "Request timeout" });
  });
  
  next();
});

// ==========================================
// BODY PARSERS
// ==========================================

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "10mb"
}));

// ==========================================
// SOCKET INJECTION
// ==========================================

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.set("io", io);

// ==========================================
// ROUTES
// ==========================================

app.use("/api/payments", paymentRoutes);
app.use("/api/orders", trackingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bundles", bundleRoutes);
app.use("/api/webhook", webhookRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: "unknown",
    redis: "connected"
  };

  try {
    health.mongodb =
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected";
  } catch (err) {
    health.mongodb = "error";
  }

  const statusCode =
    health.mongodb === "connected"
      ? 200
      : 503;

  res.status(statusCode).json(health);
});

// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {
  res.json({
    name: "Data Bundle API",
    version: "2.0.0",
    status: "running"
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  logger.error("❌ Express Error", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  // Ensure CORS headers are always returned
  const origin = req.headers.origin;

  if (origin && uniqueOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

// ==========================================
// PROCESS ERROR HANDLERS
// ==========================================

process.on("uncaughtException", async (err) => {
  logger.error("FATAL: Uncaught Exception", {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  try {
    await notificationService.sendTelegram(
      `🔴 <b>CRITICAL: Uncaught Exception</b>\n<code>${err.message}</code>`
    );
  } catch {}

  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  logger.error("FATAL: Unhandled Promise Rejection", {
    reason: reason instanceof Error
      ? reason.message
      : String(reason),

    stack: reason instanceof Error
      ? reason.stack
      : null,

    timestamp: new Date().toISOString()
  });

  try {
    await notificationService.sendTelegram(
      `🔴 <b>CRITICAL: Unhandled Rejection</b>\n<code>${
        reason instanceof Error
          ? reason.message
          : String(reason)
      }</code>`
    );
  } catch {}

  process.exit(1);
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });

    await mongoose.connection.close();

    logger.info("MongoDB connection closed");

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);

  } catch (err) {
    logger.error("Shutdown error", {
      error: err.message
    });

    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ==========================================
// SERVER STARTUP
// ==========================================

(async () => {
  try {
    await connectDB();

    logger.info("✅ Database connected");

    await import("./src/jobs/vendorProcessor.js");
    await import("./src/jobs/bundleSyncJob.js");

    startWorker();

    logger.info("✅ Worker started");

    syncEngine.init(io);

    setInterval(() => {
      syncEngine.run();
    }, 60 * 1000);

    // Run payment reconciliation every 5 minutes
    setInterval(() => {
      reconciliationService.run();
    }, 5 * 60 * 1000);

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

// ==========================================
// SOCKET EVENTS
// ==========================================

io.on("connection", (socket) => {
  logger.info("🔌 Client connected", {
    socketId: socket.id
  });

  socket.on("subscribe", (query) => {
    socket.join(`tracker-${query}`);

    logger.debug("Client subscribed", {
      socketId: socket.id,
      query
    });
  });

  socket.on("subscribeAdmin", () => {
    socket.join("admin");
    logger.info("👨‍💻 Admin subscribed to real-time updates", {
      socketId: socket.id
    });
  });

  socket.on("disconnect", () => {
    logger.info("🔌 Client disconnected", {
      socketId: socket.id
    });
  });
});