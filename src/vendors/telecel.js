


/*

import axios from "axios";
import { getPackageId } from "../services/bundleService.js";

export const sendTelecel = async (order) => {
  const NETWORK = "Telecel";

  try {
    if (!order?.phone || !order?.bundle || !order?.reference) {
      throw new Error("Missing required order fields");
    }

    const package_id = await getPackageId(NETWORK, order.bundle);

    if (!package_id) {
      throw new Error(`Missing packageId for ${NETWORK} ${order.bundle}`);
    }

    // ==========================
    // CORRECT PAYLOAD
    // ==========================
    const payload = {
      api_key: process.env.TELECEL_API_KEY,
      package_id,
      phone: order.phone,
      reference: order.reference
    };

console.log("📤 TELECEL REQUEST:", payload);

/*
const response = await axios.post(
  process.env.MTN_VENDOR_URL,
  payload,
  {
    headers: {
      "Content-Type": "application/json"
    },
    timeout: 15000
  }
);
*/
/*
    const response = await axios.post(
      process.env.TELECEL_VENDOR_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.TELECEL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (err) {
    console.log("❌ TELECEL ERROR =====================");
    console.log("Reference:", order.reference);
    console.log("Phone:", order.phone);
    console.log("Bundle:", order.bundle);
    console.log("Message:", err.response?.data || err.message);
    console.log("📦 TELECEL PACKAGE ID:", package_id);

    return {
      success: false,
      network: NETWORK,
      reference: order.reference,
      message: err.response?.data || err.message,
      status: err.response?.status || null
    };
  }
};
*/


import axios from "axios";
import { getPackageId } from "../services/bundleService.js";

export const sendTelecel = async (order) => {
  const NETWORK = "TELECEL";

  try {
    if (
      !order?.phone ||
      !order?.bundle ||
      !order?.reference
    ) {
      throw new Error(
        "Missing required order fields"
      );
    }

    // ==========================
    // FETCH REAL UUID FROM DB
    // ==========================
    const package_id =
      await getPackageId(
        NETWORK,
        order.bundle
      );

    console.log(
      "📦 TELECEL PACKAGE ID:",
      package_id
    );

    const payload = {
      api_key: process.env.TELECEL_API_KEY,
      package_id,
      phone: order.phone,
      reference: order.reference
    };

    console.log(
      "📤 TELECEL REQUEST:",
      payload
    );

    const response = await axios.post(
      process.env.TELECEL_VENDOR_URL,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.TELECEL_API_KEY}`,
          "Content-Type":
            "application/json"
        },
        timeout: 15000
      }
    );

    console.log(
      "✅ TELECEL RESPONSE:",
      response.data
    );

    return {
      success: true,
      status: response.status,
      data: response.data
    };

  } catch (err) {
    console.log(
      "❌ TELECEL ERROR ====================="
    );

    console.log(
      "Reference:",
      order.reference
    );

    console.log(
      "Phone:",
      order.phone
    );

    console.log(
      "Bundle:",
      order.bundle
    );

    console.log(
      "Vendor Error:",
      err.response?.data || err.message
    );

    return {
      success: false,
      network: NETWORK,
      reference: order.reference,
      message:
        err.response?.data || err.message,
      status:
        err.response?.status || null
    };
  }
};




