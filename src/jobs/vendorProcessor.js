
/*
import cron from "node-cron";
import Order from "../models/Order.js";
import { sendToVendor } from "../vendors/vendorClient.js";

console.log("Vendor processor started...");



// ==========================
// RUN EVERY 30 SECONDS
// ==========================
cron.schedule("*///30 * * * * *", async () => {
  /*
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

*/

import cron from "node-cron";

import Order from "../models/Order.js";

import {
  sendToVendor,
  getVendorStatus
} from "../vendors/vendorClient.js";

console.log("Vendor processor started...");

// ========================================
// PROCESS NEW + RETRY ORDERS
// ========================================
cron.schedule("*/30 * * * * *", async () => {

  try {

    const now = new Date();

    // ========================================
    // FETCH ELIGIBLE ORDERS
    // ========================================
    const orders = await Order.find({

      paymentStatus: "completed",

      vendorStatus: {
        $in: ["pending", "queued", "failed"]
      },

      retryCount: {
        $lt: 4
      },

      $or: [
        {
          nextRetryAt: null
        },
        {
          nextRetryAt: {
            $lte: now
          }
        }
      ]

    })
    .sort({ createdAt: 1 })
    .limit(10);

    if (!orders.length) return;

    console.log(
      `📦 Processing ${orders.length} orders...`
    );

    for (const order of orders) {

      try {

        // ========================================
        // LOCK ORDER
        // ========================================
        const locked =
          await Order.findOneAndUpdate(

            {
              _id: order._id,

              vendorStatus: {
                $in: ["pending", "queued", "failed"]
              }
            },

            {
              vendorStatus: "processing",

              orderStatus: "processing",

              processingStartedAt:
                new Date()
            },

            {
              new: true
            }
          );

        if (!locked) continue;

        console.log(
          "🚀 Sending to vendor:",
          order.reference
        );

        // ========================================
        // SEND TO VENDOR
        // ========================================
        const result =
          await sendToVendor(order);

        console.log(
          "📡 VENDOR RESPONSE DEBUG:"
        );

        console.log(
          JSON.stringify(result, null, 2)
        );

        // ========================================
        // ANALYZE RESPONSE
        // ========================================
        const errorText =
          JSON.stringify(
            result?.message || ""
          ).toLowerCase();

        const isBalanceError =
          errorText.includes(
            "insufficient balance"
          );

        const isSuccess =
          result?.success === true;

        const currentRetries =
          order.retryCount || 0;

        const nextRetryCount =
          currentRetries + 1;

        // ========================================
        // 5 MIN RETRY DELAY
        // ========================================
        const nextRetryAt =
          new Date(
            Date.now() +
            5 * 60 * 1000
          );

        // ========================================
        // PERMANENT FAILURE
        // ========================================
        const exceededRetries =
          nextRetryCount >= 4;

        let vendorStatus = "failed";
        let orderStatus = "failed";

        // ========================================
        // SUCCESS
        // ========================================
        if (isSuccess) {

          vendorStatus = "sent";

          orderStatus = "processing";
        }

        // ========================================
        // RETRYABLE FAILURE
        // ========================================
        else if (!exceededRetries) {

          vendorStatus = "failed";

          orderStatus =
            isBalanceError
              ? "pending_vendor_balance"
              : "retrying";
        }

        // ========================================
        // PERMANENT FAILURE
        // ========================================
        else {

          vendorStatus = "failed";

          orderStatus = "failed";
        }

        // ========================================
        // SAVE UPDATE
        // ========================================
        await Order.findByIdAndUpdate(
          order._id,

          {
            vendorStatus,

            orderStatus,

            retryCount: isSuccess
              ? currentRetries
              : nextRetryCount,

            lastRetryAt:
              new Date(),

            nextRetryAt:
              isSuccess
                ? null
                : exceededRetries
                  ? null
                  : nextRetryAt,

            vendorResponse: {
              success:
                result?.success,

              retries:
                nextRetryCount,

              message:
                result?.message ||
                result?.error,

              raw: result,

              timestamp:
                new Date()
            }
          }
        );

        // ========================================
        // LOGGING
        // ========================================
        if (isSuccess) {

          console.log(
            `✅ Vendor accepted: ${order.reference}`
          );
        }

        else if (!exceededRetries) {

          console.log(
            `🟡 Queued For Retry: ${order.reference}`
          );

          console.log({
            retryCount:
              nextRetryCount,

            nextRetryAt
          });
        }

        else {

          console.log(
            `💀 Permanent Failure: ${order.reference}`
          );

          console.log({
            retries:
              nextRetryCount
          });
        }

      } catch (err) {

        console.error(
          "🔥 VENDOR PROCESSING ERROR:"
        );

        console.error(
          "Reference:",
          order.reference
        );

        console.error(
          err.message
        );

        await Order.findByIdAndUpdate(
          order._id,

          {
            vendorStatus: "failed",

            orderStatus: "failed",

            vendorResponse: {
              error: err.message,

              stack: err.stack,

              timestamp:
                new Date()
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
      "💥 Vendor processor fatal error:",
      err.message
    );
  }
});

// ========================================
// STATUS SYNC JOB
// ========================================
console.log(
  "🔄 Status sync job started..."
);

cron.schedule(
  "*/45 * * * * *",
  async () => {

    try {

      // ========================================
      // FETCH SENT ORDERS ONLY
      // ========================================
      const orders =
        await Order.find({

          paymentStatus:
            "completed",

          vendorStatus: {
            $in: [
              "sent",
              "processing"
            ]
          }

        })
        .limit(20);

      if (!orders.length) return;

      console.log(
        `🔄 Checking ${orders.length} orders...`
      );

      for (const order of orders) {

        try {

          console.log(
            "📡 STATUS CHECK:",
            order.reference
          );

          // ========================================
          // FETCH STATUS
          // ========================================
          const vendor =
            await getVendorStatus(
              order.reference
            );

          console.log(
            "Vendor Status:",
            vendor?.status
          );

          if (!vendor?.success) {
            continue;
          }

          const status =
            String(
              vendor?.status || ""
            )
            .trim()
            .toLowerCase();

          // ========================================
          // SUCCESS STATES
          // ========================================
          const successStates = [
            "success",
            "successful",
            "completed",
            "delivered"
          ];

          // ========================================
          // FAILURE STATES
          // ========================================
          const failedStates = [
            "failed",
            "rejected",
            "cancelled"
          ];

          let update = {};

          // ========================================
          // SUCCESS
          // ========================================
          if (
            successStates.includes(
              status
            )
          ) {

            update = {

              vendorStatus:
                "success",

              orderStatus:
                "completed",

              completedAt:
                new Date(),

              vendorResponse: {
                success: true,

                message:
                  vendor?.message,

                raw:
                  vendor?.raw,

                timestamp:
                  new Date()
              }
            };

            console.log(
              `✅ Order completed: ${order.reference}`
            );
          }

          // ========================================
          // FAILED
          // ========================================
          else if (
            failedStates.includes(
              status
            )
          ) {

            update = {

              vendorStatus:
                "failed",

              orderStatus:
                "failed",

              vendorResponse: {
                success: false,

                message:
                  vendor?.message,

                raw:
                  vendor?.raw,

                timestamp:
                  new Date()
              }
            };

            console.log(
              `❌ Order failed: ${order.reference}`
            );
          }

          // ========================================
          // STILL PROCESSING
          // ========================================
          else {

            update = {

              vendorStatus:
                "processing",

              orderStatus:
                "processing"
            };
          }

          await Order.findByIdAndUpdate(
            order._id,
            update
          );

        } catch (err) {

          console.log(
            `❌ Status sync failed: ${order.reference}`
          );

          console.log(
            err.message
          );
        }
      }

    } catch (err) {

      console.error(
        "💥 Status sync fatal error:",
        err.message
      );
    }
  }
);