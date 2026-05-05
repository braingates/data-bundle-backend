// paymentController.js
import Order from "../models/Order.js";
import { initPayment } from "../services/paymentService.js";
import crypto from "crypto";
import axios from "axios";

export const createPayment = async (req, res) => {
  try {
    const { phone, network, amount, bundle } = req.body;

    console.log("📦 Incoming payment request:", req.body);

    console.log("PAYSTACK KEY EXISTS:", !!process.env.PAYSTACK_SECRET);

    // ==========================
    // VALIDATION (STRICT)
    // ==========================
    if (!phone || !network || !amount || !bundle) {
      return res.status(400).json({
        error: "Missing required payment fields",
        details: { phone: !!phone, network: !!network, amount: !!amount, bundle: !!bundle }
      });
    }

   

    const numericAmount = Math.round(Number(amount) * 100);

if (isNaN(numericAmount) || numericAmount <= 0) {
  return res.status(400).json({
    error: "Invalid amount",
    received: amount
  });
}
    // ==========================
    // REFERENCE GENERATION
    // ==========================
    function generateOrderId() {
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const type = Math.random() > 0.5 ? "A" : "B";

      if (type === "A") {
        return (
          Math.floor(100 + Math.random() * 900).toString() +
          letters[Math.floor(Math.random() * letters.length)]
        );
      } else {
        return (
          Math.floor(10 + Math.random() * 90).toString() +
          letters[Math.floor(Math.random() * letters.length)] +
          letters[Math.floor(Math.random() * letters.length)]
        );
      }
    }

    const reference = generateOrderId();

    // ==========================
    // CREATE ORDER
    // ==========================
    const order = await Order.create({
      phone,
      network: network.toUpperCase(),
      amount: numericAmount,
      bundle,
      reference,
      paymentStatus: "pending",
      vendorStatus: "pending",
      orderStatus: "pending"
    });

    console.log("🧾 Order created:", order);

    // ==========================
    // INIT PAYMENT (SAFE PAYLOAD ONLY)
    // ==========================
    let payment;

    try {
      payment = await initPayment({
        reference: order.reference,
        amount: numericAmount,
        email: `${order.phone}@mail.com`
      });
    } catch (payErr) {
      console.error("❌ Paystack init failed:", payErr.response?.data || payErr.message);

      // Clean up failed order
      await Order.findByIdAndDelete(order._id);

      return res.status(502).json({
        error: "Payment gateway failed",
        details: payErr.response?.data?.message || payErr.message
      });

      
    }

    // ==========================
    // SUCCESS RESPONSE
    // ==========================
    return res.json({
      authorization_url: payment.authorization_url,
      reference: order.reference,
      orderId: order._id
    });

  } catch (err) {
    console.error("🔥 createPayment error:", err);
    console.error("Stack:", err.stack);

    return res.status(500).json({
      error: "Payment initiation failed",
      message: err.message
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!process.env.PAYSTACK_SECRET) {
      throw new Error("PAYSTACK_SECRET not configured");
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
        }
      }
    );

    const data = response.data.data;
    const success = data.status === "success";

    await Order.findOneAndUpdate(
      { reference },
      {
        paymentStatus: success ? "completed" : "failed",
        orderStatus: success ? "paid" : "failed"
      }
    );

    return res.json({ 
      success,
      data: {
        reference,
        status: data.status,
        amount: data.amount / 100
      }
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err.message);
    return res.status(500).json({ 
      error: "Verification failed",
      message: err.message 
    });
  }
};