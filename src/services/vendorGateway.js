import Order from "../models/Order.js";
import { sendToMtn, checkMtnHealth } from "./mtnVendorService.js";
import { sendToTelecel, checkTelecelHealth } from "./telecelVendorService.js";
import { sendToAirtelTigo, checkAirtelTigoHealth } from "./airteltigoVendorService.js";
import logger from "../utils/logger.js";
import crypto from "crypto";
import { auditLogger } from "../models/AuditLog.js";
import notificationService from "./notificationService.js";

const MAX_RETRIES = 4;

/**
 * Detect balance errors for specialized retry timing
 */
const checkBalanceError = (res) => {
  const text = JSON.stringify(res || "").toLowerCase();
  return text.includes("insufficient balance") || text.includes("low balance");
};

/**
 * Fetches a unique reference/tracking ID from the vendor's API.
 * Point this to your vendor's initialization endpoint if they support it.
 */
export const fetchInitialReference = async (network) => {
  try {
    logger.info(`Fetching initial reference from ${network} API...`);
    
    // Implementation: Call vendor's 'get-reference' or 'initialize' endpoint here.
    // For now, we return a uniquely structured vendor-prefixed reference.
    const hexPart = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-character hex
    const networkPrefix = network.substring(0, 3).toUpperCase();
    return `VND-${networkPrefix}-${hexPart}`;
  } catch (err) {
    logger.error(`Failed to fetch reference from ${network} vendor`, { error: err.message });
    throw new Error(`Vendor reference generation failed: ${err.message}`);
  }
};

/**
 * Check if order was already successfully sent to vendor (idempotency protection)
 */
export const isOrderAlreadyDispatched = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) return false;
  return order.vendorStatus === "success" || order.vendorStatus === "sent";
};

/**
 * Dispatch order to appropriate vendor with idempotency protection
 */
export const dispatchToVendor = async (order) => {
  if (!order || !order._id) {
    throw new Error("Invalid order object");
  }

  if (order.paymentStatus !== "completed") {
    throw new Error("Payment not verified for this order");
  }

  const network = order.network?.toUpperCase();
  if (!network) {
    throw new Error("Network not specified");
  }

  // Check idempotency - if already sent, don't send again
  if (order.vendorStatus === "success" || order.vendorStatus === "sent") {
    logger.warn("Order already dispatched to vendor (idempotency check)", {
      reference: order.reference,
      vendorStatus: order.vendorStatus,
      vendorReference: order.vendorReference
    });
    return {
      success: true,
      vendorReference: order.vendorReference,
      response: order.vendorResponse,
      alreadyDispatched: true
    };
  }

  let result;
  const startTime = Date.now();

  try {
    switch (network) {
      case "MTN":
        result = await sendToMtn(order);
        break;
      case "TELECEL":
        result = await sendToTelecel(order);
        break;
      case "AIRTELTIGO":
        result = await sendToAirtelTigo(order);
        break;
      default:
        throw new Error(`Unsupported network: ${network}`);
    }

    const duration = Date.now() - startTime;

    // Update order with vendor response
    await Order.findByIdAndUpdate(order._id, {
      vendorStatus: result.success ? "sent" : "failed",
      orderStatus: result.success ? "processing" : "failed",
      vendorReference: result.vendorReference || "",
      vendorResponse: result.response || result.error,
      lastRetryAt: new Date()
    });

    auditLogger.log({
      action: "vendor_dispatch",
      entity: "Order",
      entityId: order._id,
      orderId: order.reference,
      changes: { vendorStatus: result.success ? "sent" : "failed" },
      metadata: {
        network,
        duration,
        vendorRef: result.vendorReference,
        success: result.success
      }
    });

    logger.info("Vendor dispatch completed", {
      reference: order.reference,
      network,
      success: result.success,
      duration: `${duration}ms`,
      vendorRef: result.vendorReference
    });

    return result;
  } catch (err) {
    logger.error("Vendor dispatch failed", {
      reference: order.reference,
      network,
      error: err.message
    });

    auditLogger.log({
      action: "vendor_dispatch_error",
      entity: "Order",
      entityId: order._id,
      orderId: order.reference,
      changes: { vendorStatus: "failed" },
      metadata: { network, error: err.message }
    });

    throw err;
  }
};

/**
 * Get health status of all vendor APIs
 */
export const checkVendorHealth = async () => {
  const [mtn, telecel, airteltigo] = await Promise.allSettled([
    checkMtnHealth(),
    checkTelecelHealth(),
    checkAirtelTigoHealth()
  ]);

  const normalize = (result) => {
    if (result.status === "rejected") return { status: "down", error: result.reason?.message };
    const data = result.value;
    // If balance is 0, we flag it as 'warning' instead of 'success'
    if (data.status === "success" && data.balance <= 0) return { ...data, status: "low_balance" };
    return data;
  };

  return {
    MTN: normalize(mtn),
    Telecel: normalize(telecel),
    AirtelTigo: normalize(airteltigo)
  };
};

/**
 * Process order with automatic retry logic
 */
export const processOrderWithRetry = async (orderId) => {
  let order;
  try {
    order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Idempotency check
    if (order.vendorStatus === "success" || order.vendorStatus === "sent") {
      logger.info("Order already successfully sent to vendor", { reference: order.reference });
      return { success: true, order: orderId, alreadyProcessed: true };
    }

    // Lock order for processing
    const locked = await Order.findOneAndUpdate(
      { _id: orderId, vendorStatus: { $in: ["pending", "failed", "retrying"] } },
      { vendorStatus: "processing", processingStartedAt: new Date() },
      { new: true }
    );

    if (!locked) {
      logger.warn("Order already being processed", { reference: order.reference });
      return { success: false, reason: "Order already being processed" };
    }

    const result = await dispatchToVendor(locked);

    // Update final order status
    const currentRetryCount = (order.retryCount || 0) + 1;
    const maxAllowed = order.maxRetries || 4;
    const isFinalFailure = !result.success && currentRetryCount >= maxAllowed;
    const isBalanceError = checkBalanceError(result.response || result.error);

    const finalStatus = result.success ? "processing" : (isFinalFailure ? "failed" : "retrying");
    const actualStatus = (!result.success && !isFinalFailure && isBalanceError) ? "pending_vendor_balance" : finalStatus;
    const nextRetryAt = (!result.success && !isFinalFailure) ? calculateNextRetry(isBalanceError) : null;

    if (isFinalFailure) {
      notificationService.sendTelegram(
        `🔴 <b>Order Failed Permanently</b>\n` +
        `Ref: <code>${order.reference}</code>\n` +
        `Phone: <code>${order.phone}</code>\n` +
        `Network: ${order.network}\n` +
        `Bundle: ${order.bundle}\n` +
        `Reason: ${result.error || 'Max retries reached'}`
      ).catch(e => logger.error("Admin failure notification failed", { error: e.message }));
    }

    await Order.findByIdAndUpdate(orderId, {
      vendorStatus: result.success ? "sent" : "failed",
      orderStatus: actualStatus,
      vendorReference: result.vendorReference || "",
      vendorResponse: result.response || result.error,
      retryCount: currentRetryCount,
      nextRetryAt,
      lastRetryAt: new Date()
    });

    logger.info("Order processing completed", {
      reference: order.reference,
      success: result.success,
      nextRetry: nextRetryAt
    });

    return { success: result.success, order: orderId };
  } catch (err) {
    logger.error("Order processing failed", {
      orderId: order?.reference || orderId,
      error: err.message
    });
    
    const currentRetryCount = (order?.retryCount || 0) + 1;
    const isFinalFailure = currentRetryCount >= (order?.maxRetries || 4);
    const isBalanceError = checkBalanceError(err.message);
    const nextRetryAt = !isFinalFailure ? calculateNextRetry(isBalanceError) : null;

    if (isFinalFailure) {
      notificationService.sendTelegram(
        `🔴 <b>Order Processing Error (Final)</b>\n` +
        `Ref: <code>${order?.reference || orderId}</code>\n` +
        `Error: <code>${err.message}</code>`
      ).catch(e => logger.error("Admin error notification failed", { error: e.message }));
    }

    await Order.findByIdAndUpdate(orderId, {
      vendorStatus: "failed",
      orderStatus: isFinalFailure ? "failed" : (isBalanceError ? "pending_vendor_balance" : "retrying"),
      vendorResponse: { error: err.message },
      retryCount: currentRetryCount,
      nextRetryAt,
      lastRetryAt: new Date()
    });

    auditLogger.log({
      action: "vendor_dispatch_error",
      entity: "Order",
      entityId: order?._id,
      orderId: order?.reference,
      changes: { orderStatus: "retrying" },
      metadata: { error: err.message, nextRetry: nextRetryAt }
    });

    return { success: false, error: err.message };
  }
};

/**
 * Calculate next retry time with exponential backoff
 * Logic: 10m for balance errors (30m total), 5m for others.
 */
function calculateNextRetry(isBalanceError = false) {
  const delay = isBalanceError ? 10 * 60 * 1000 : 5 * 60 * 1000;
  return new Date(Date.now() + delay);
}