import crypto from "crypto";
import Order from "../models/Order.js";

// ==========================
// PAYSTACK WEBHOOK
// ==========================
export const paystackWebhook = async (req, res) => {
  try {
    // ==========================
    // VERIFY SIGNATURE
    // ==========================
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    const event = req.body;

    // ==========================
    // HANDLE SUCCESS ONLY
    // ==========================
    if (event.event === "charge.success") {
      const reference = event.data.reference;

      const order = await Order.findOne({ reference });

      if (!order) return res.sendStatus(404);

      // ==========================
      // IDEMPOTENCY GUARD
      // ==========================
      if (order.paymentStatus === "completed") {
        return res.sendStatus(200);
      }

      // ==========================
      // UPDATE ORDER
      // ==========================
      order.paymentStatus = "completed";
      order.orderStatus = "pending";
      await order.save();

      // ==========================
      // OPTIONAL: TRIGGER VENDOR PIPELINE
      // (IMPORTANT FOR YOUR SYSTEM)
      // ==========================
      // Example:
      // await sendToQueue("orders", { orderId: order._id });
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
};