import axios from "axios";
import crypto from "crypto";
import logger from "../utils/logger.js";

const MTN_API_BASE = process.env.MTN_VENDOR_URL;
const MTN_API_KEY = process.env.MTN_API_KEY;
const MAX_RETRIES = 4;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export async function sendToMtn(order, attempt = 1) {
  if (!MTN_API_BASE || !MTN_API_KEY) {
    throw new Error("MTN vendor configuration missing");
  }

  const payload = {
    phone: order.phone,
    package_id: order.vendorPackageId || order.bundle,
    reference: order.reference,
    amount: order.amount
  };

  try {
    const response = await axios.post(MTN_API_BASE, payload, {
      headers: {
        Authorization: `Bearer ${MTN_API_KEY}`,
        "Content-Type": "application/json",
        "X-Request-ID": order.idempotencyKey || crypto.randomUUID()
      },
      timeout: 30000
    });

    logger.info(`MTN vendor success for order ${order.reference}`, {
      vendorRef: response.data?.reference || response.data?.id,
      response: response.data
    });

    return {
      success: true,
      vendorReference: response.data?.reference || response.data?.id,
      response: response.data
    };
  } catch (err) {
    const errorData = {
      attempt,
      error: err.response?.data || err.message,
      status: err.response?.status
    };

    logger.error(`MTN vendor attempt ${attempt} failed for order ${order.reference}`, errorData);

    if (attempt < MAX_RETRIES) {
      const delay = calculateBackoff(attempt);
      logger.info(`Retrying MTN order ${order.reference} in ${delay}ms`);
      await sleep(delay);
      return sendToMtn(order, attempt + 1);
    }

    return {
      success: false,
      error: err.response?.data || err.message,
      attempts: attempt
    };
  }
}

export async function checkMtnHealth() {
  if (!MTN_API_BASE || !MTN_API_KEY) {
    return { status: "down", balance: 0, error: "Configuration missing" };
  }

  try {
    // Most vendors use a 'balance' or 'profile' check instead of a generic '/health'
    // Defaulting to a balance check which is more reliable for health monitoring
    const response = await axios.get(`${MTN_API_BASE.replace('/order', '/balance')}`, {
      headers: { Authorization: `Bearer ${MTN_API_KEY}` },
      timeout: 10000
    });

    return {
      status: response.data?.status || "up",
      balance: response.data?.balance || 0
    };
  } catch (err) {
    return { status: "down", balance: 0, error: err.message };
  }
}