
/*
import express from "express";
import cors from "cors";

import orderRoutes from "../routes/orderRoutes.js";
import paymentRoutes from "../routes/paymentRoutes.js";
import trackingRoutes from "../routes/trackRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";



const app = express();

// ==========================
// MIDDLEWARE
// ==========================
app.use(cors());
app.use(express.json());


// optional: request logger (helps debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ==========================
// ROUTES
// ==========================
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/admin", adminRoutes);
console.log("TRACK ROUTES LOADED");



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
  console.error("Server Error:", err.message);

  res.status(500).json({
    error: "Internal server error"
  });
});

/////////////////////////////


export default app;

*/




import express from "express";
import cors from "cors";

import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import trackingRoutes from "./routes/trackRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import bundleRoutes from "./routes/bundleRoutes.js";

const app = express();

// ==========================
// CORS (PRODUCTION SAFE)
// ==========================
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://megabytestation.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ==========================
// CORE MIDDLEWARE
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================
// REQUEST LOGGER (DEV ONLY)
// ==========================
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ==========================
// ROUTES
// ==========================
app.use("/api/orders", orderRoutes);
app.use("/api/orders", trackingRoutes); // IMPORTANT: same namespace
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bundles", bundleRoutes);

// ==========================
// 404 HANDLER
// ==========================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ==========================
// GLOBAL ERROR HANDLER
// ==========================
app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

export default app;