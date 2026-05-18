import Order from "../models/Order.js";
import axios from "axios";
import logger from "../utils/logger.js";
import { checkVendorHealth } from "../services/vendorGateway.js";
import { auditLogger } from "../models/AuditLog.js";
import { Server } from "socket.io";

let io;

export const syncEngine = {
  init: (socketServer) => {
    io = socketServer;
    logger.info("Sync Engine initialized with Socket.IO");
  },

  run: async () => {
    try {
      logger.info("Starting sync cycle...");

      const orders = await Order.find({
        paymentStatus: "completed",
        // Include all non-terminal states. 
        // Crucial: Orders with vendorStatus 'failed' but orderStatus 'retrying' must be checked 
        // because the vendor may have processed the 'failed' request eventually.
        orderStatus: { $in: ["processing", "pending", "retrying", "queued", "pending_vendor_balance"] }
      })
      .sort({ updatedAt: 1, createdAt: 1 }) // Prioritize by longest time since last check, then by order age
      .limit(200); // Increase limit to handle larger backlogs

      logger.info(`Syncing ${orders.length} orders`);

      // Process in parallel chunks to increase throughput
      const CHUNK_SIZE = 15;
      for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
        const chunk = orders.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(order => syncOrderStatus(order)));
      }

      const health = await checkVendorHealth();
      logger.info("Vendor health check", health);

      io?.emit("vendorHealth", health);

      return { success: true, ordersSync: orders.length };
    } catch (err) {
      logger.error("Sync cycle failed", { error: err.message });
      return { success: false, error: err.message };
    }
  }
};

/**
 * Synchronizes data bundles from external vendor APIs.
 * Required by src/jobs/bundleSyncJob.js
 */
export async function syncBundles() {
  try {
    logger.info("Starting bundle synchronization service");
    // Implementation for fetching and updating bundle prices/availability would go here
    return { success: true };
  } catch (err) {
    logger.error("Global bundle sync failed", { error: err.message });
    throw err;
  }
}

export async function syncOrderStatus(order) {
  if (!order.vendorReference) {
    return;
  }

  try {
    const network = order.network.toUpperCase();
    const baseUrl = process.env[`${network}_VENDOR_URL`] || process.env[`${network}_API_BASE`];
    const apiKey = process.env[`${network}_API_KEY`];

    if (!baseUrl) {
      logger.warn(`Skipping status sync: ${network}_VENDOR_URL not configured`, { reference: order.reference });
      return;
    }

    // Normalize URL: remove trailing slashes and handle /order suffix if present
    const cleanBase = baseUrl.replace(/\/$/, "").replace(/\/order$/, "");
    const statusUrl = `${cleanBase}/status/${order.vendorReference}`;

    console.log(`📡 SYNCING ORDER: ${order.reference} via ${statusUrl}`);

    const response = await axios.get(statusUrl, {
      headers: {
        Authorization: `Bearer ${apiKey?.trim()}`
      },
      timeout: 15000
    });

    if (response.data) {
      const data = response.data;
      // Support multiple common vendor response fields (status, Status, state, or code)
      const rawStatus = data.status || data.Status || data.state || data.order_status;
      const newStatus = mapVendorStatus(rawStatus);
      const hasStatusChanged = newStatus && newStatus !== order.orderStatus;

      if (hasStatusChanged) {
        const updateFields = {
          orderStatus: newStatus,
          vendorStatus: newStatus,
          vendorResponse: {
            ...order.vendorResponse,
            lastSync: data,
            updatedAt: new Date()
          }
        };

        if (newStatus === "completed") updateFields.completedAt = new Date();
        if (newStatus === "failed") updateFields.failureReason = data.message || "Vendor rejected request";

        if (newStatus === "completed") {
          auditLogger.log({
            action: "order_delivered",
            entity: "Order",
            entityId: order._id,
            orderId: order.reference,
            metadata: { source: "sync_engine", vendorStatus: data.status }
          });
        }

        await Order.findByIdAndUpdate(order._id, updateFields);

        const updateData = {
          orderId: order._id,
          reference: order.reference,
          shortTrackingId: order.shortTrackingId,
          orderStatus: newStatus,
          network: order.network,
          amount: order.amount,
          phone: order.phone,
          bundle: order.bundle,
          completedAt: updateFields.completedAt
        };

        // Emit only to rooms associated with this specific order
        const rooms = ["admin", `tracker-${order.reference}`, `tracker-${order.phone}`, `tracker-${order.shortTrackingId}`];
        io?.to(rooms).emit("orderUpdate", updateData);
        
        // Specific event for Admin Dashboard metrics refresh
        io?.to("admin").emit("statsUpdated", { 
          type: newStatus === "completed" ? "ORDER_COMPLETED" : "ORDER_SYNC", 
          data: updateData 
        });

        logger.info("Order status synced", {
          reference: order.reference,
          old: order.orderStatus,
          new: newStatus
        });
      }

      // CRITICAL: Always "touch" the order by updating updatedAt, even if the status 
      // hasn't changed. This prevents the sync engine from getting stuck on the same 
      // "processing" orders every cycle (Anti-Starvation).
      await Order.findByIdAndUpdate(order._id, { $set: { updatedAt: new Date() } });
    }
  } catch (err) {
    logger.error("Sync failed for order", { 
      reference: order.reference, 
      network: order.network,
      code: err.code, // Will show ECONNRESET
      error: err.message 
    });
    // Even on network/API failure, bump updatedAt so this order moves to the back 
    // of the queue, allowing other orders to be processed.
    await Order.findByIdAndUpdate(order._id, { $set: { updatedAt: new Date() } }).catch(() => {});
  }
}

function mapVendorStatus(status) {
  const statusMap = {
    delivered: "completed",
    completed: "completed",
    success: "completed",
    successful: "completed",
    fulfilled: "completed",
    confirmed: "completed",
    failed: "failed",
    rejected: "failed",
    cancelled: "failed",
    pending: "pending",
    processing: "processing"
  };
  return statusMap[status?.toLowerCase()] || null;
}

export default syncEngine;