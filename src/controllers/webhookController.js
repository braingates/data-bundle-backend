import crypto from "crypto";
import Order from "../models/Order.js";
import WebhookLog from "../models/WebhookLog.js";
import { vendorQueue } from "../services/queue.js";
import logger from "../utils/logger.js";
import notificationService from "../services/notificationService.js";
import { auditLogger } from "../models/AuditLog.js";

export const paystackWebhook = async (req, res) => {
  try {
    // Get raw body for signature verification
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      logger.warn("Invalid webhook signature", {
        received: req.headers["x-paystack-signature"],
        computed: hash,
        timestamp: new Date().toISOString()
      });
      return res.sendStatus(401);
    }

    // Parse the body if it's a Buffer
    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;

    if (event.event === "charge.success") {
      const reference = event.data?.reference;
      const amount = event.data?.amount;
      const paystackTimestamp = event.data?.paid_at;

      if (!reference || !amount) {
        logger.warn("Invalid webhook data", { event });
        return res.sendStatus(400);
      }

      // Deduplication check - prevent processing same webhook within 5 minute window
      const recentWebhook = await WebhookLog.findOne({
        reference,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      if (recentWebhook) {
        logger.warn("Duplicate webhook ignored (within 5 min window)", {
          reference,
          previouslyProcessed: recentWebhook.createdAt,
          currentAttempt: new Date().toISOString()
        });
        // Return 200 so Paystack stops retrying
        return res.sendStatus(200);
      }

      // Log this webhook for future deduplication
      await WebhookLog.create({
        reference,
        event: event.event,
        paystackTimestamp: new Date(paystackTimestamp * 1000)
      });

      const order = await Order.findOne({ reference });
      if (!order) {
        logger.warn("Order not found for webhook", { reference });
        return res.sendStatus(404);
      }

      if (order.paymentStatus === "completed") {
        logger.info("Order already completed, webhook is idempotent", {
          reference,
          previousCompletion: order.updatedAt
        });
        return res.sendStatus(200);
      }

      // Verify amount matches (convert from cents)
      const webhookAmount = Math.round(amount / 100);
      if (webhookAmount !== order.amount) {
        logger.error("Amount mismatch in webhook", {
          reference,
          orderAmount: order.amount,
          webhookAmount
        });
        // Alert admin to potential fraud
        await notificationService.sendTelegram(
          `⚠️ <b>Payment Amount Mismatch Alert</b>\n` +
          `Reference: ${reference}\n` +
          `Expected: ${order.amount}\n` +
          `Received: ${webhookAmount}`
        );
        return res.sendStatus(400);
      }

      order.paymentStatus = "completed";
      order.orderStatus = "queued";
      order.vendorStatus = "pending";
      await order.save();

      logger.info("Payment verified via webhook", {
        reference,
        amount: webhookAmount,
        network: order.network
      });

      auditLogger.log({
        action: "payment_verified",
        entity: "Order",
        entityId: order._id,
        orderId: reference,
        changes: { paymentStatus: "completed", orderStatus: "queued" },
        metadata: { amount: webhookAmount, gateway: "paystack" }
      });

      await vendorQueue.add("dispatch", {
        orderId: order._id,
        phone: order.phone,
        network: order.network,
        bundle: order.bundle,
        amount: order.amount,
        reference: order.reference
      }, {
        attempts: 2, // Minor retry for internal errors only
        backoff: { type: "fixed", delay: 5000 }
      });

      logger.info("Order queued for vendor dispatch", { reference });

      const io = req.app.get("io");
      const update = {
        orderId: order._id,
        reference,
        status: "completed"
      };
      io?.to(["admin", `tracker-${reference}`, `tracker-${order.phone}`, `tracker-${order.shortTrackingId}`]).emit("paymentConfirmed", update);
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error("Webhook processing error", {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.sendStatus(500);
  }
};