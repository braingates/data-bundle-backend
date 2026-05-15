


import cron from "node-cron";
import Order from "../models/Order.js";
import { sendToVendor } from "../services/vendorRouter.js";




console.log("🚀 Vendor Worker Started");

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
        // ==========================
        // LOCK ORDER (PREVENT DUPLICATES)
        // ==========================
        const locked = await Order.findOneAndUpdate(
          {
            _id: order._id,
            vendorStatus: "pending"
          },
          { vendorStatus: "processing" },
          { new: true }
        );

        if (!locked) continue;

        console.log(`🚀 Sending to vendor: ${order.reference}`);

        // ==========================
        // VENDOR CALL (YOUR LINE)
        // ==========================
       // const result = await sendToVendor(order);

        // ==========================
        // DEBUG LOGGING
        // ==========================
        console.log("📡 Vendor Result:", {
          reference: order.reference,
          success: result.success,
          error: result.error || result.message
        });

        // ==========================
        // UPDATE ORDER STATE
        // ==========================
        await Order.findByIdAndUpdate(order._id, {
          vendorStatus: result.success ? "success" : "failed",
          orderStatus: result.success ? "completed" : "failed",
          vendorResponse: result
        });

        console.log(
          result.success
            ? `✅ Success: ${order.reference}`
            : `❌ Failed: ${order.reference}`
        );

      } catch (err) {
        console.error(`❌ Worker Error (${order.reference}):`, err.message);

        await Order.findByIdAndUpdate(order._id, {
          vendorStatus: "failed",
          orderStatus: "failed",
          vendorResponse: { error: err.message }
        });
      }
    }

    console.log("✔ Vendor cycle complete");

  } catch (err) {
    console.error("❌ Worker crash:", err.message);
  }
});

//////////////////////////////////////////////////////

/*
import cron from "node-cron";

import Order from "../models/Order.js";

import { sendToVendor } from "../vendors/vendorClient.js";

console.log(
  "🚀 Vendor Worker Started"
);

// ==========================
// RUN EVERY 30 SECONDS
// ==========================
cron.schedule(
  "*///30 * * * * *",
  /*
  async () => {

    try {

      const orders =
        await Order.find({

          paymentStatus:
            "completed",

          vendorStatus:
            "pending"

        }).limit(10);

      if (!orders.length) return;

      console.log(
        `📦 Processing ${orders.length} orders...`
      );

      for (const order of orders) {

        try {

          // ==========================
          // LOCK ORDER
          // ==========================
          const locked =
            await Order.findOneAndUpdate(

              {
                _id: order._id,

                vendorStatus:
                  "pending"
              },

              {
                vendorStatus:
                  "processing",

                orderStatus:
                  "processing"
              },

              {
                vendorStatus:
                  "completed",

                orderStatus:
                  "completed"
              },
              

              {
                new: true
              }
            );

          if (!locked) continue;

          console.log(
            `🚀 Sending to vendor: ${order.reference}`
          );

          // ==========================
          // FIXED RESULT
          // ==========================
          const result =
            await sendToVendor(order);

          console.log(
            "📡 Vendor Result:",
            {
              reference:
                order.reference,

              success:
                result.success,

              error:
                result.error ||
                result.message
            }
          );

          // ==========================
          // ACCEPTED
          // ==========================
          if (result.success) {

            await Order.findByIdAndUpdate(

              order._id,

              {
                vendorStatus:
                  "sent",

                orderStatus:
                  "processing",

                vendorResponse:
                  result
              }
            );

            console.log(
              `✅ Accepted: ${order.reference}`
            );
          }

          // ==========================
          // FAILED
          // ==========================
          else {

            await Order.findByIdAndUpdate(

              order._id,

              {
                vendorStatus:
                  "failed",

                orderStatus:
                  "failed",

                vendorResponse:
                  result
              }
            );

            console.log(
              `❌ Failed: ${order.reference}`
            );
          }

        } catch (err) {

          console.error(
            `❌ Worker Error (${order.reference}):`,
            err.message
          );

          await Order.findByIdAndUpdate(

            order._id,

            {
              vendorStatus:
                "failed",

              orderStatus:
                "failed",

              vendorResponse: {
                error:
                  err.message
              }
            }
          );
        }
      }

      console.log(
        "✔ Vendor cycle complete"
      );

    } catch (err) {

      console.error(
        "❌ Worker crash:",
        err.message
      );
    }
  }
);

*/