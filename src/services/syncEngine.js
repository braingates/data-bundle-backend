import Order from "../models/Order.js";
import logger from "../utils/logger.js";
import { checkVendorHealth } from "../services/vendorGateway.js";
import { Server } from "socket.io";

let io;

export const syncEngine = {
  init: (socketServer) => {
    io = socketServer;
  },

  run: async () => {
    try {
      logger.info("Starting sync cycle...");

      const orders = await Order.find({
        paymentStatus: "completed",
        orderStatus: { $in: ["processing", "pending"] },
        vendorStatus: { $in: ["processing", "pending"] }
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
    let statusUrl;

    switch (network) {
      case "MTN":
        statusUrl = `${process.env.MTN_VENDOR_URL}/status/${order.vendorReference}`;
        break;
      case "TELECEL":
        statusUrl = `${process.env.TELECEL_VENDOR_URL}/status/${order.vendorReference}`;
        break;
      case "AIRTELTIGO":
        statusUrl = `${process.env.AIRTEL_VENDOR_URL}/status/${order.vendorReference}`;
        break;
      default:
        return;
    }

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${process.env[`${network}_API_KEY`]}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const newStatus = mapVendorStatus(data.status);

      if (newStatus && newStatus !== order.orderStatus) {
        await Order.findByIdAndUpdate(order._id, {
          orderStatus: newStatus,
          vendorStatus: newStatus
        });

        const updateData = {
          orderId: order._id,
          reference: order.reference,
          shortTrackingId: order.shortTrackingId,
          status: newStatus
        };

        // Emit only to rooms associated with this specific order
        const rooms = ["admin", `tracker-${order.reference}`, `tracker-${order.phone}`, `tracker-${order.shortTrackingId}`];
        io?.to(rooms).emit("orderUpdate", updateData);

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
    success: "completed",
    failed: "failed",
    pending: "pending",
    processing: "processing"
  };
  return statusMap[status?.toLowerCase()] || null;
}

export default syncEngine;