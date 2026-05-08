



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


// src/vendors/telecel.js
import axios from "axios";
import Bundle from "../models/Bundle.js";

export const sendTelecel = async (order) => {
  const NETWORK = "TELECEL";

  try {
    if (!order?.phone || !order?.bundle || !order?.reference) {
      throw new Error("Missing required order fields");
    }

    // Get the REAL vendor package ID from database
    const bundle = await Bundle.findOne({
      network: NETWORK,
      name: order.bundle.toUpperCase()
    });

    if (!bundle || !bundle.vendorPackageId) {
      throw new Error(`No vendor package ID found for ${NETWORK} ${order.bundle}`);
    }

    const package_id = bundle.vendorPackageId;
    
    console.log(`📤 Sending Telecel order with REAL package ID: ${package_id}`);

    // Try multiple possible API formats
    const baseUrl = process.env.TELECEL_VENDOR_URL;
    const apiKey = process.env.TELECEL_API_KEY;
    
    const payloads = [
      // Format 1: Standard
      { api_key: apiKey, package_id, phone: order.phone, reference: order.reference },
      // Format 2: With endpoint
      { api_key: apiKey, endpoint: "order", package_id, phone: order.phone, reference: order.reference },
      // Format 3: With action
      { api_key: apiKey, action: "order", package_id, phone: order.phone, reference: order.reference },
    ];
    
    let lastError = null;
    
    for (const payload of payloads) {
      try {
        const response = await axios.post(baseUrl, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000
        });
        
        // Check if order was accepted
        if (response.data && response.data.success !== false) {
          console.log(`✅ Telecel order sent successfully using format:`, Object.keys(payload));
          return {
            success: true,
            status: response.status,
            data: response.data,
            message: response.data.message || "Order accepted"
          };
        }
        
        if (response.data && response.data.error) {
          console.log(`⚠️ Telecel rejected: ${response.data.error}`);
          lastError = response.data.error;
        }
        
      } catch (err) {
        lastError = err.response?.data?.error || err.message;
      }
    }
    
    throw new Error(lastError || "All payload formats failed");
    
  } catch (err) {
    console.log("❌ TELECEL ERROR:", err.message);
    
    return {
      success: false,
      network: NETWORK,
      reference: order.reference,
      message: err.message,
      status: 400
    };
  }
};




