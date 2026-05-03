import axios from "axios";
import { getPackageId } from "./vendorMappingEngine.js";

/**
 * ==========================
 * GENERIC VENDOR CALLER
 * ==========================
 */
export const sendToVendor = async (order) => {
  const network = order.network.toUpperCase();

  const package_id = await getPackageId(network, order.bundle);

  if (!package_id) {
    return {
      success: false,
      error: `No package_id found for ${network} ${order.bundle}`
    };
  }

  let url;
  let headers = {};
  let payload = {};

  switch (network) {
    case "MTN":
      url = process.env.MTN_VENDOR_URL;
      headers = {
        Authorization: `Bearer ${process.env.MTN_API_KEY}`
      };
      payload = { phone: order.phone, package_id, reference: order.reference };
      break;

    case "TELECEL":
      url = process.env.TELECEL_VENDOR_URL;
      headers = {
        Authorization: `Bearer ${process.env.TELECEL_API_KEY}`
      };
      payload = { phone: order.phone, package_id, reference: order.reference };
      break;

    case "AIRTELTIGO":
      url = process.env.AIRTEL_VENDOR_URL;
      headers = {
        Authorization: `Bearer ${process.env.AIRTEL_API_KEY}`
      };
      payload = { phone: order.phone, package_id, reference: order.reference };
      break;

    default:
      return {
        success: false,
        error: `Unsupported network: ${network}`
      };
  }

  console.log(`🚀 [${network}] REQUEST:`, payload);
  console.log(`🔗 URL:`, url);

  try {
    const response = await axios.post(url, payload, {
      headers,
      timeout: 15000
    });

    console.log(`📥 [${network}] RESPONSE:`, response.data);

    return {
      success: true,
      data: response.data,
      network
    };

  } catch (err) {
    console.log(`❌ [${network}] ERROR:`, {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });

    return {
      success: false,
      error: err.response?.data || err.message,
      network
    };
  }
};