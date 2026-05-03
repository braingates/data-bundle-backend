import express from "express";
import { createPayment, verifyPayment } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create", createPayment);
router.get("/verify/:reference", verifyPayment);

import { verifyApiKey } from "../middleware/auth.js";

router.get("/admin/orders", verifyApiKey, async (req, res) => {
  // protected route
});

export default router;