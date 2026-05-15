import express from "express";
import { createPayment, verifyPayment } from "../controllers/paymentController.js";
import { verifyJwt } from "../middleware/auth.js";

const router = express.Router();

// Public endpoints - no auth required
router.post("/create", createPayment);
router.get("/verify/:reference", verifyPayment);

export default router;