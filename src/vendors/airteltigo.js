

import axios from "axios";
import { getPackageId } from "../services/bundleService.js";

export const sendAirtel = async (order) => {
  const NETWORK = "AIRTELTIGO";

  try {
    // ==========================
    // 1. VALIDATION
    // ==========================
    if (!order?.phone) throw new Error("Missing phone");
    if (!order?.bundle) throw new Error("Missing bundle");
    if (!order?.reference) throw new Error("Missing reference");

    if (!process.env.AIRTEL_VENDOR_URL) {
      throw new Error("AIRTEL_VENDOR_URL not configured");
    }

    if (!process.env.AIRTEL_API_KEY) {
      throw new Error("AIRTEL_API_KEY not configured");
    }

    // ==========================
    // 2. GET PACKAGE ID
    // ==========================
    const package_id = await getPackageId(NETWORK, order.bundle);

    if (!package_id) {
      throw new Error(`❌ Bundle not found: ${NETWORK} ${order.bundle}`);
    }

    // ==========================
    // 3. BUILD CLEAN PAYLOAD
    // ==========================
    const payload = {
      phone: order.phone,
      package_id,
      bundle: order.bundle,
      reference: order.reference
    };

    console.log("📤 AIRTEL REQUEST:", payload);
    console.log("🔑 AIRTEL URL:", process.env.AIRTELTIGO_VENDOR_URL);

    // ==========================
    // 4. SEND REQUEST
    // ==========================
    const response = await axios.post(
      process.env.AIRTEL_VENDOR_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log("📥 AIRTEL RESPONSE STATUS:", response.status);
    console.log("📥 AIRTEL RESPONSE DATA:", response.data);

    return {
      success: true,
      data: response.data,
      status: response.status,
      network: NETWORK
    };

  } catch (err) {
    // ==========================
    // 5. FULL DEBUG LOGGING
    // ==========================
    console.log("❌ AIRTEL ERROR =====================");
    console.log("Reference:", order?.reference);
    console.log("Phone:", order?.phone);
    console.log("Bundle:", order?.bundle);
    console.log("Status:", err.response?.status);
    console.log("Data:", err.response?.data);
    console.log("Message:", err.message);

    return {
      success: false,
      network: NETWORK,
      reference: order?.reference,
      error: err.response?.data || err.message,
      status: err.response?.status || null
    };
  }
};