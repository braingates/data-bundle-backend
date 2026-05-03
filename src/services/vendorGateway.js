import { sendMTN } from "../vendors/mtn.js";
import { sendTelecel } from "../vendors/telecel.js";
import { sendAirtel } from "../vendors/airteltigo.js";

import { resolvePackageId } from "./vendorMapper.js";
import { normalizeVendorResponse } from "./vendorNormalizer.js";

const VENDOR_HANDLERS = {
  MTN: sendMTN,
  TELECEL: sendTelecel,
  AIRTELTIGO: sendAirtel
};

// 🔥 fallback chain
const FALLBACKS = {
  MTN: ["TELECEL"],
  TELECEL: ["AIRTELTIGO"],
  AIRTELTIGO: []
};

export const sendToVendor = async (order) => {
  const network = order.network.toUpperCase();

  const attemptNetworks = [network, ...(FALLBACKS[network] || [])];

  for (const net of attemptNetworks) {
    try {
      console.log(`🚀 Attempting ${net} for ${order.reference}`);

      const package_id = resolvePackageId(net, order.bundle);

      const handler = VENDOR_HANDLERS[net];

      if (!handler) {
        throw new Error(`No handler for ${net}`);
      }

      const result = await handler({
        ...order,
        network: net,
        package_id
      });

      const normalized = normalizeVendorResponse(net, result);

      console.log("📡 NORMALIZED:", normalized);

      if (normalized.success) {
        return {
          success: true,
          network: net,
          message: normalized.message,
          raw: normalized.raw
        };
      }

      console.log(`⚠️ ${net} failed → trying fallback...`);

    } catch (err) {
      console.log(`❌ ${net} ERROR:`, err.message);
    }
  }

  return {
    success: false,
    message: "All vendors failed"
  };
};