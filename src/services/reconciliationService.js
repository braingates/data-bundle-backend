import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import axios from "axios";

export const reconciliationService = {
  run: async () => {
    try {
      logger.info("Starting reconciliation cycle");

      const stuckOrders = await Order.find({
        paymentStatus: "completed",
        vendorStatus: "pending",
        orderStatus: "pending",
        createdAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) }
      }).limit(50);

      logger.info(`Found ${stuckOrders.length} stuck orders`);

      let recovered = 0;
      for (const order of stuckOrders) {
        const paystackStatus = await verifyPaystackPayment(order.reference);

        if (paystackStatus.paid && !paystackStatus.found) {
          await Order.findByIdAndUpdate(order._id, {
            orderStatus: "paid",
            vendorStatus: "processing"
          });
          recovered++;
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