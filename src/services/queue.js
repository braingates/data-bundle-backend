import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import logger from "../utils/logger.js";
import Order from "../models/Order.js";
import { dispatchToVendor } from "../services/vendorGateway.js";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

export const orderQueue = new Queue("orders", { connection });

export const vendorQueue = new Queue("vendor-dispatch", { connection });

export const retryQueue = new Queue("order-retries", { connection });

export const syncQueue = new Queue("vendor-sync", { connection });

export const sendToVendorQueue = async (orderId, orderData) => {
  const job = await vendorQueue.add("dispatch", {
    orderId,
    ...orderData
  }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false
  });

  logger.info("Added to vendor queue", { jobId: job.id, orderId });
  return job;
};

export const scheduleRetry = async (orderId, delayMs) => {
  const job = await retryQueue.add("retry", {
    orderId
  }, {
    delay: delayMs,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false
  });

  logger.info("Scheduled retry", { jobId: job.id, orderId, delayMs });
  return job;
};

export const scheduleSync = async (intervalSec = 60) => {
  const job = await syncQueue.add("sync", {}, {
    repeat: { cron: `*/${intervalSec} * * * *` },
    removeOnComplete: true
  });

  return job;
};

export const startWorker = () => {
  const worker = new Worker("vendor-dispatch", async (job) => {
    const { orderId, phone, network, bundle, amount, reference } = job.data;

    let order;
    try {
      order = await Order.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.paymentStatus !== "completed") {
        throw new Error(`Order ${orderId} payment not completed`);
      }

      const updated = await Order.findOneAndUpdate(
        { _id: orderId, vendorStatus: "pending" },
        { vendorStatus: "processing", processingStartedAt: new Date() },
        { new: true }
      );

      if (!updated) {
        return { success: false, reason: "Order already being processed" };
      }

      const result = await dispatchToVendor(order);

      await Order.findByIdAndUpdate(orderId, {
        vendorStatus: result.success ? "success" : "failed",
        orderStatus: result.success ? "completed" : "retrying",
        vendorReference: result.vendorReference || "",
        vendorResponse: result.response || result.error,
        completedAt: result.success ? new Date() : undefined,
        retryCount: (order.retryCount || 0) + 1,
        nextRetryAt: result.success ? null : calculateNextRetry(order.retryCount || 0)
      });

      return { success: result.success, orderId };
    } catch (err) {
      logger.error("Worker error", { orderId, error: err.message });

      await Order.findByIdAndUpdate(orderId, {
        vendorStatus: "failed",
        orderStatus: "failed",
        vendorResponse: { error: err.message }
      });

      throw err;
    }
  }, {
    connection,
    concurrency: 5,
    removeOnComplete: true,
    removeOnFail: false
  });

  worker.on("completed", (job) => {
    logger.info("Worker completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("Worker failed", { jobId: job?.id, error: err.message });
  });

  return worker;
};

function calculateNextRetry(retryCount) {
  const delays = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000];
  const delay = delays[retryCount] || delays[delays.length - 1];
  return new Date(Date.now() + delay);
}

export default {
  orderQueue,
  vendorQueue,
  retryQueue,
  sendToVendorQueue,
  scheduleRetry,
  startWorker
};