import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import axios from "axios";

export const reconciliationService = {
  run: async () => {
    try {
      logger.info("Starting reconciliation cycle");

      const stuckOrders = await Order.find({
        paymentStatus: "pending",
        orderStatus: "pending",
        retryCount: { $lt: 4 },
        createdAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) }
      }).limit(50);

      logger.info(`Found ${stuckOrders.length} stuck orders`);

      let recovered = 0;
      for (const order of stuckOrders) {
        const paystackStatus = await verifyPaystackPayment(order.reference);

        if (paystackStatus.paid) {
          await Order.findByIdAndUpdate(order._id, {
            paymentStatus: "completed",
            orderStatus: "queued"
          });
          recovered++;
        } else if (order.retryCount >= 3) {
          // Mark as failed if it hasn't been paid after 4 checks (approx 20 mins)
          await Order.findByIdAndUpdate(order._id, {
            paymentStatus: "failed",
            orderStatus: "failed",
            failureReason: "Payment verification timeout"
          });
        } else {
          await Order.findByIdAndUpdate(order._id, {
            $inc: { retryCount: 1 }
          });
        }
      }

      return { success: true, stuckOrders: stuckOrders.length, recovered };
    } catch (err) {
      logger.error("Reconciliation failed", { error: err.message });
      return { success: false, error: err.message };
    }
  }
};

async function verifyPaystackPayment(reference) {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
        }
      }
    );

    const data = response.data.data;
    return {
      paid: data.status === "success",
      amount: data.amount,
      found: true
    };
  } catch (err) {
    return { paid: false, found: false };
  }
}

export default reconciliationService;