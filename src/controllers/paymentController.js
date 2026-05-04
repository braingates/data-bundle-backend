
import Order from "../models/Order.js";
import { initPayment } from "../services/paymentService.js";
import crypto from "crypto";
import axios from "axios";



export const createPayment = async (req, res) => {
  try {
    const { phone, network, amount, bundle } = req.body;

    console.log("📦 Incoming payment request:", req.body);

    // ==========================
    // VALIDATION (STRICT)
    // ==========================
    if (!phone || !network || !amount || !bundle) {
      return res.status(400).json({
        error: "Missing required payment fields"
      });
    }

    const numericAmount = Number(amount);

    if (isNaN(numericAmount)) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    // ==========================
    // REFERENCE
    // ==========================
    function generateOrderId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  const type = Math.random() > 0.5 ? "A" : "B";

  if (type === "A") {
    // 3 numbers + 1 letter (e.g. 482K)
    return (
      Math.floor(100 + Math.random() * 900).toString() +
      letters[Math.floor(Math.random() * letters.length)]
    );
  } else {
    // 2 numbers + 2 letters (e.g. 48AB)
    return (
      Math.floor(10 + Math.random() * 90).toString() +
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)]
    );
  }
};
    const reference = generateOrderId();

    // ==========================
    // CREATE ORDER
    // ==========================
    const order = await Order.create({
      phone,
      network,
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
        email: `${phone}@megabytestation`//"customer@email.com"
      });
    } catch (payErr) {
      console.error("❌ Paystack init failed:", payErr.response?.data || payErr.message);

      await Order.findByIdAndDelete(order._id);

      return res.status(500).json({
        error: "Payment gateway failed"
      });
    }

    // ==========================
    // RESPONSE
    // ==========================
    return res.json({
      authorization_url: payment.authorization_url,
      reference: order.reference,
      orderId: order._id
    });

  } catch (err) {
    console.error("🔥 createPayment error:", err);

    return res.status(500).json({
      error: "Payment init failed"
    });
  }
};


export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

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

    return res.json({ success });

  } catch (err) {
    console.error("VERIFY ERROR:", err.message);
    return res.status(500).json({ error: "Verification failed" });
  }
};

