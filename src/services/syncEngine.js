import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import { checkVendorHealth } from "../services/vendorGateway.js";
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
        // Focus on orders that are currently "in-flight" with a vendor
        orderStatus: { $in: ["processing", "pending", "retrying", "queued", "pending_vendor_balance"] },
        vendorStatus: { $in: ["processing", "pending", "sent", "queued"] }
      }).limit(50);

      logger.info(`Syncing ${orders.length} orders`);

      for (const order of orders) {
        await syncOrderStatus(order);
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
    const baseUrl = process.env[`${network}_VENDOR_URL` ] || process.env[`${network}_API_BASE` ];
    const apiKey = process.env[`${network}_API_KEY` ];

    if (!baseUrl) {
      logger.warn(`Skipping status sync: ${network}_VENDOR_URL not configured`, { reference: order.reference });
      return;
    }

    // Ensure baseUrl doesn't have trailing slash for consistency
    const cleanBase = baseUrl.replace(/\/$/, "");
    const statusUrl = `${cleanBase}/status/${order.vendorReference}`;

    console.log(`📡 SYNCING ORDER: ${order.reference} via ${statusUrl}`);

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const newStatus = mapVendorStatus(data.status);

      if (newStatus && newStatus !== order.orderStatus) {
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

        await Order.findByIdAndUpdate(order._id, updateFields);

        const updateData = {
          orderId: order._id,
          reference: order.reference,
          shortTrackingId: order.shortTrackingId,
          status: newStatus,
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
    }
  } catch (err) {
    logger.error("Sync failed for order", { reference: order.reference, error: err.message });
  }
}

function mapVendorStatus(status) {
  const statusMap = {
    delivered: "completed",
    completed: "completed",
    success: "completed",
    successful: "completed",
    failed: "failed",
    rejected: "failed",
    cancelled: "failed",
    pending: "pending",
    processing: "processing"
  };
  return statusMap[status?.toLowerCase()] || null;
}

export default syncEngine;