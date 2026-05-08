

import cron from "node-cron";
import Order from "../models/Order.js";
import { sendToVendor } from "../vendors/vendorClient.js";

console.log("Vendor processor started...");



// ==========================
// RUN EVERY 30 SECONDS
// ==========================
cron.schedule("*/30 * * * * *", async () => {
  try {
    const orders = await Order.find({
      paymentStatus: "completed",
      vendorStatus: "pending"
    }).limit(10);

    if (!orders.length) return;

    console.log(`📦 Processing ${orders.length} orders...`);

    for (const order of orders) {
      try {
        // LOCK ORDER
        const locked = await Order.findOneAndUpdate(
          {
            _id: order._id,
            vendorStatus: "pending"
          },
          { vendorStatus: "processing" },
          {orderStatus: "processing"},
          { new: true }
          
        );

        if (!locked) continue;

        console.log("🚀 Sending to vendor:", order.reference);

        // SEND TO VENDOR
        const result = await sendToVendor(order);

        // 🔥 FULL DEBUG OUTPUT (IMPORTANT)
        console.log("📡 VENDOR RESPONSE DEBUG:");
        console.log("Reference:", order.reference);
        console.log("Success:", result?.success);
        console.log("Message:", result?.message || result?.error || "No message");
        console.log("Raw Response:", JSON.stringify(result, null, 2));

        // ==========================
        // FAILURE ANALYSIS
        // ==========================
        const isSuccess = result?.success === true;

        const updateData = {
          vendorStatus: isSuccess ? "success" : "failed",
          orderStatus: isSuccess ? "completed" : "failed",
          vendorResponse: {
            success: result?.success,
            message: result?.message || result?.error,
            raw: result,
            timestamp: new Date()
          }
        };

        await Order.findByIdAndUpdate(order._id, updateData);

        // CLEAN LOGGING
        if (isSuccess) {
          console.log(`✅ Success: ${order.reference}`);
        } else {
          console.log(`❌ Failed: ${order.reference}`);
          console.log("❗ FAILURE REASON:", {
            message: result?.message || result?.error,
            network: order.network,
            bundle: order.bundle,
            phone: order.phone
          });
        }

      } catch (err) {
        console.error("🔥 VENDOR PROCESSING ERROR:");
        console.error("Reference:", order.reference);
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);

        await Order.findByIdAndUpdate(order._id, {
          vendorStatus: "failed",
          orderStatus: "failed",
          vendorResponse: {
            error: err.message,
            stack: err.stack,
            timestamp: new Date()
          }
        });
      }
    }

    console.log("✔ Vendor cycle complete");

  } catch (err) {
    console.error("💥 Vendor processor fatal error:", err.message);
  }
});

