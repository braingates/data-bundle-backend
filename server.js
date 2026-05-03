import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import { connectDB } from "./src/config/db.js";

import paymentRoutes from "./src/routes/paymentRoutes.js";
import trackingRoutes from "./src/routes/trackRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

const app = express();
const PORT = process.env.PORT || 5001;

// ==========================
// CORS (FULLY FIXED)
// ==========================
const corsOptions = {
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ==========================
// MIDDLEWARE
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================
// OPTIONAL: API KEY PROTECTION (ADMIN ONLY)
// ==========================
app.use("/api/admin", (req, res, next) => {
  // allow preflight
  if (req.method === "OPTIONS") return next();

  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

// ==========================
// ROUTES
// ==========================
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", trackingRoutes);
app.use("/api/admin", adminRoutes);

// ==========================
// HEALTH CHECK
// ==========================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==========================
// START SERVER AFTER DB
// ==========================
(async () => {
  try {
    await connectDB();

    const { startBundleSyncJob } = await import("./src/jobs/bundleSyncJob.js");
    await startBundleSyncJob();

    // start vendor processor ONLY after DB and initial bundles are ready
    await import("./src/jobs/vendorProcessor.js");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Server startup failed:", err);
    process.exit(1);
  }
})();


import bundleRoutes from "./src/routes/bundleRoutes.js";

app.use("/api/bundles", bundleRoutes);