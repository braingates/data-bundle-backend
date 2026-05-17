import cron from "node-cron";
import Order from "../models/Order.js";
import { auditLogger } from "../models/AuditLog.js";
import { getVendorStatus } from "../vendors/vendorClient.js";

console.log("🔄 Status sync job started...");

// ==========================
// RUN EVERY 20 SECONDS
// ==========================
cron.schedule("*/20 * * * * *", async () => {
  try {
    const orders = await Order.find({
      paymentStatus: "completed",
      vendorStatus: { $in: ["processing", "pending"] }
    }).limit(10);

    if (!orders.length) return;

    console.log(`🔄 Checking ${orders.length} orders...`);

    for (const order of orders) {
      try {
        const result = await getVendorStatus(order.reference);

        console.log(`📡 STATUS CHECK: ${order.reference}`);
        console.log("Vendor Status:", result.status);

        if (!result.success) continue;

        const status = (result.status || "").toLowerCase();

        let vendorStatus = order.vendorStatus;
        let orderStatus = order.orderStatus;

        // ==========================
        // MAP VENDOR → SYSTEM STATUS
        // ==========================
        if (status.includes("success") || status.includes("successful") || status.includes("completed") || status.includes("delivered") || status.includes("sent")) {
          vendorStatus = "completed";
          orderStatus = "completed";
        } else if (status.includes("processing") || status.includes("pending")) {
          vendorStatus = "processing";
          orderStatus = "processing";
        } else if (status.includes("fail")) {
          vendorStatus = "failed";
          orderStatus = "failed";
        }

        if (orderStatus === "completed" && order.orderStatus !== "completed") {
          auditLogger.log({
            action: "order_delivered",
            entity: "Order",
            entityId: order._id,
            orderId: order.reference,
            metadata: { source: "status_sync_job", vendorStatus: status }
          });
        }

        await Order.findByIdAndUpdate(order._id, {
          vendorStatus,
          orderStatus,
          vendorResponse: {
            ...order.vendorResponse,
            lastCheck: new Date(),
            statusFromVendor: status,
            raw: result.raw
          }
        });

      } catch (err) {
        console.error(`❌ Sync error: ${order.reference}`, err.message);
      }
    }

  } catch (err) {
    console.error("💥 Sync job error:", err.message);
  }
});