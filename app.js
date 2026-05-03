import express from "express";
import cors from "cors";

import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import trackingRoutes from "./routes/trackRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

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



export default app;