import Order from "../models/Order.js";
import { initPayment } from "../services/paymentService.js";
import crypto from "crypto";
import axios from "axios";
import logger from "../utils/logger.js";
import Bundle from "../models/Bundle.js"; // Import Bundle model
import { validatePhoneNetwork } from "../utils/phoneValidator.js";
import { fetchInitialReference } from "../services/vendorGateway.js";

/**
 * Generate idempotency key to prevent duplicate orders
 */
const generateIdempotencyKey = (phone, network, amount, bundle) => {
  // Remove Date.now() to allow detection of actual duplicate requests
  const data = `${phone}:${network}:${amount}:${bundle}`;
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Generates a short tracking ID: 3 numbers and 1 uppercase letter.
 */
const generateUniqueShortTrackingId = async () => {
  for (let i = 0; i < 10; i++) {
    const numbers = Math.floor(100 + Math.random() * 900); // 100-999
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    const candidate = `${numbers}${letter}`;
    const existing = await Order.findOne({ shortTrackingId: candidate });
    if (!existing) return candidate;
  }
  // Fallback: add one more random number if collisions are frequent
  return `${Math.floor(1000 + Math.random() * 8999)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
};

export const createPayment = async (req, res) => {
  try {
    const { phone, network, amount, bundle } = req.body;

    logger.info("Payment request received", { phone, network, amount, bundle });

    if (!phone || !network || !amount || !bundle) {
      return res.status(400).json({
        error: "Missing required fields",
        details: { phone: !!phone, network: !!network, amount: !!amount, bundle: !!bundle }
      });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const networkUpper = network.toUpperCase();
    if (!["MTN", "TELECEL", "AIRTELTIGO"].includes(networkUpper)) {
      return res.status(400).json({ error: "Invalid network" });
    }

    // Validate phone number matches network
    const phoneValidation = validatePhoneNetwork(phone, networkUpper);
    if (!phoneValidation.valid) {
      return res.status(400).json({ 
        error: "Phone validation failed",
        details: phoneValidation.error 
      });
    }

    // Check for duplicate pending orders within last 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const duplicate = await Order.findOne({
      phone: phoneValidation.normalized,
      bundle: bundle,
      paymentStatus: "pending",
      createdAt: { $gte: thirtyMinsAgo }
    });

    if (duplicate) {
      const elapsedMs = Date.now() - new Date(duplicate.createdAt).getTime();
      const remainingMins = Math.max(1, 30 - Math.floor(elapsedMs / (1000 * 60)));

      return res.status(409).json({
        error: "duplicate_pending",
        message: `A similar order for this number is already pending. To prevent duplicate orders, please wait ${remainingMins} more minute(s) until the previous order is finalized before placing another identical order. You can check the status of your transaction on the orders page.`
      });
    }

    // Fetch reference from Vendor API instead of generating locally
    const reference = await fetchInitialReference(networkUpper);
    const shortTrackingId = await generateUniqueShortTrackingId();

    const baseIdempotency = generateIdempotencyKey(phone, networkUpper, numericAmount, bundle);
    const order = await Order.create({
      phone: phoneValidation.normalized,
      network: networkUpper,
      amount: numericAmount,
      bundle,
      reference,
      shortTrackingId, // Store the new internal tracking ID
      idempotencyKey: `${baseIdempotency}:${reference}`, // Unique per attempt to allow duplicates
      paymentStatus: "pending",
      orderStatus: "pending",
      vendorStatus: "pending"
    });

    logger.info("Order created", { reference, orderId: order._id, idempotencyKey: order.idempotencyKey });

    let payment;
    try {
      payment = await initPayment({
        reference: order.reference,
        amount: numericAmount,
        email: `${order.phone}@mail.com`
      });
    } catch (payErr) {
      logger.error("Paystack init failed", { error: payErr.message });
      await Order.findByIdAndDelete(order._id);
      return res.status(502).json({ error: "Payment gateway failed" });
    }

    return res.json({
      authorization_url: payment.authorization_url,
      reference: order.reference,
      orderId: order._id
    });
  } catch (err) {
    logger.error("createPayment error", { 
      message: err.message, 
      code: err.code, // Useful for detecting E11000 duplicate keys
      stack: err.stack 
    });
    
    if (err.code === 11000) {
      return res.status(409).json({ error: "Order reference collision occurred. Please try again." });
    }

    return res.status(500).json({ error: "Payment initiation failed" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: "Reference not provided" });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
        timeout: 10000
      }
    );

    const data = response.data.data;

    if (!data || !data.reference) {
      logger.error("Invalid Paystack response", { reference });
      return res.status(502).json({ error: "Invalid payment gateway response" });
    }

    const order = await Order.findOne({ reference });
    if (!order) {
      logger.warn("Order not found for verification", { reference });
      return res.status(404).json({ error: "Order not found" });
    }

    const isSuccess = data.status === "success";
    
    if (isSuccess && order.paymentStatus !== "completed") {
      await Order.findOneAndUpdate(
        { reference },
        {
          paymentStatus: "completed",
          orderStatus: "queued",
          vendorStatus: "pending"
        }
      );

      logger.info("Payment verified", { reference, status: data.status });
    } else if (!isSuccess && order.paymentStatus === "pending") {
      await Order.findOneAndUpdate(
        { reference },
        {
          paymentStatus: "failed",
          orderStatus: "failed",
          failureReason: data.gateway_response
        }
      );

      logger.info("Payment failed", { reference, status: data.status });
    }

    return res.json({
      success: isSuccess,
      data: { 
        reference, 
        status: data.status, 
        amount: data.amount / 100,
        orderStatus: order.orderStatus
      }
    });
  } catch (err) {
    logger.error("Verify error", { error: err.message });
    return res.status(502).json({ error: "Verification failed" });
  }
};