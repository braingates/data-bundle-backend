import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import Order from "../models/Order.js";
import { dispatchToVendor } from "../services/vendorGateway.js";
import logger from "../utils/logger.js";
import notificationService from "../services/notificationService.js";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

const vendorQueue = new Queue("vendor-dispatch", { connection });

export const startWorker = () => {
  const worker = new Worker("vendor-dispatch", async (job) => {
    const { orderId, phone, network, bundle, amount, reference } = job.data;

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.paymentStatus !== "completed") {
        logger.warn("Skipping order - payment not completed", { reference });
        return { success: false, reason: "Payment not completed" };
      }

      // ATOMIC LOCK: Only pick up orders that are not already being handled or finished
      const locked = await Order.findOneAndUpdate(
        { 
          _id: orderId, 
          vendorStatus: { $in: ["pending", "failed", "retrying"] },
          orderStatus: { $nin: ["completed", "delivered"] }
        },
        { vendorStatus: "processing", orderStatus: "processing", processingStartedAt: new Date() },
        { new: true }
      );

      if (!locked) {
        return { success: false, reason: "Order already processed or in progress" };
      }

      // Use the locked order instance to ensure we have the most current data
      const result = await dispatchToVendor(locked);

      const update = {
        vendorStatus: result.success ? "success" : "failed",
        orderStatus: result.success ? "completed" : "retrying",
        vendorReference: result.vendorReference || "",
        vendorResponse: result.response || result.error,
        completedAt: result.success ? new Date() : undefined,
      };

      if (!result.success) {
        update.$inc = { retryCount: 1 };
      }

      const updatedOrder = await Order.findByIdAndUpdate(orderId, update, { new: true });

      if (result.success) {
        logger.info("Order processed successfully", { reference });
      } else if (updatedOrder.retryCount < 4) {
        const delay = 5 * 60 * 1000; // Fixed 5-minute interval

        await vendorQueue.add("dispatch", job.data, {
          delay,
          attempts: 1
        });

        await Order.findByIdAndUpdate(orderId, {
          nextRetryAt: new Date(Date.now() + delay)
        });
      } else {
        await Order.findByIdAndUpdate(orderId, {
          orderStatus: "failed",
          vendorStatus: "failed"
        });
        notificationService.sendTelegram(`🔴 <b>Order Failed Permanently</b>\nRef: <code>${order.reference}</code>\nError: ${result.error || 'Max retries reached'}`);
      }

      return { success: result.success };
    } catch (err) {
      logger.error("Worker error", { orderId, error: err.message });

      await Order.findByIdAndUpdate(orderId, {
        vendorStatus: "failed",
        orderStatus: "failed"
      });

      throw err;
    }
  }, {
    connection,
    concurrency: 5,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 }
  });

  worker.on("completed", (job) => {
    logger.info("Worker job completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("Worker job failed", { jobId: job?.id, error: err.message });
  });

  return worker;
};

export default { startWorker };