import Order from "../models/Order.js";
import { dispatchToVendor } from "../services/vendorGateway.js";
import { scheduleRetry } from "../services/queue.js";
import logger from "../utils/logger.js";

export const retryService = {
  processRetries: async () => {
    try {
      const orders = await Order.find({
        paymentStatus: "completed",
        orderStatus: "retrying",
        retryCount: { $lt: 4 },
        nextRetryAt: { $lte: new Date() }
      }).limit(20);

      logger.info(`Processing ${orders.length} retry orders`);

      for (const order of orders) {
        await processRetry(order);
      }

      return { success: true, retries: orders.length };
    } catch (err) {
      logger.error("Retry processing failed", { error: err.message });
      return { success: false, error: err.message };
    }
  },

  scheduleNextRetry: (order, isBalanceError = false) => {
    const delay = isBalanceError ? 10 * 60 * 1000 : 5 * 60 * 1000;
    return scheduleRetry(order._id, delay);
  }
};

async function processRetry(order) {
  try {
    const result = await dispatchToVendor(order);

    const errorText = JSON.stringify(result.error || result.response || "").toLowerCase();
    const isBalanceError = errorText.includes("insufficient balance");

    if (result.success) {
      await Order.findByIdAndUpdate(order._id, {
        vendorStatus: "success",
        orderStatus: "completed",
        vendorReference: result.vendorReference,
        vendorResponse: result.response,
        completedAt: new Date()
      });

      logger.info("Retry succeeded", { reference: order.reference });
    } else {
      const newRetryCount = (order.retryCount || 0) + 1;
      const nextRetry = getNextRetryDate(newRetryCount, isBalanceError);

      await Order.findByIdAndUpdate(order._id, {
        retryCount: newRetryCount,
        nextRetryAt: nextRetry,
        vendorResponse: result.error,
        orderStatus: newRetryCount >= 4 ? "failed" : "retrying",
        vendorStatus: newRetryCount >= 4 ? "failed" : "pending"
      });

      if (newRetryCount < 4) {
        await scheduleRetry(order._id, getNextDelay(newRetryCount, isBalanceError));
        logger.info("Retry scheduled", { reference: order.reference, attempt: newRetryCount });
      } else {
        logger.error("Max retries reached", { reference: order.reference });
      }
    }
  } catch (err) {
    logger.error("Retry failed", { reference: order.reference, error: err.message });
  }
}

function getNextRetryDate(retryCount, isBalanceError = false) {
  const delay = isBalanceError ? 10 * 60 * 1000 : 5 * 60 * 1000;
  return new Date(Date.now() + delay);
}

function getNextDelay(retryCount, isBalanceError = false) {
  return isBalanceError ? 10 * 60 * 1000 : 5 * 60 * 1000;
}

export default retryService;