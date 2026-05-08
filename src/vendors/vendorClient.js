/*
import { sendMTN } from "../vendors/mtn.js";
import { sendTelecel } from "../vendors/telecel.js";
import { sendAirtel } from "../vendors/airteltigo.js";

export const sendToVendor = async (order) => {
  try {
    if (!order?.network) {
      throw new Error("Missing network in order");
    }

    const network = order.network.trim().toUpperCase();

    let result;

    switch (network) {
      case "MTN":
        result = await sendMTN(order);
        break;

      case "TELECEL":
        result = await sendTelecel(order);
        break;
        

      case "AIRTELTIGO":
        result = await sendAirtel(order);
        break;

      default:
        throw new Error(`Unsupported network: ${order.network}`);
    }

    // ✅ STRONG SUCCESS CHECK
    const isSuccess =
      result?.success === true &&
      (!result?.status || (result.status >= 200 && result.status < 300));

    // ✅ NORMALIZED RESPONSE
    return {
      success: isSuccess,
      status: result?.status || null,
      state: isSuccess ? "sent" : "failed",
      message:
        result?.message ||
        result?.data?.message ||
        "No response",
      raw: result
    };

  } catch (err) {
    return {
      success: false,
      status: null,
      state: "failed",
      message: err.message
    };
  }
};

export const getVendorStatus = async (reference) => {
  try {
    const res = await axios.get(
      `${process.env.VENDOR_STATUS_URL}/${reference}`
    );

    const data = res.data;

    return {
      success: true,
      status: data.status || data.state,
      message: data.message,
      raw: data
    };

  } catch (err) {
    return {
      success: false,
      message: err.response?.data?.message || err.message
    };
  }
};

*/

import axios from "axios";

import { sendMTN } from "../vendors/mtn.js";
import { sendTelecel } from "../vendors/telecel.js";
import { sendAirtel } from "../vendors/airteltigo.js";

// ==========================
// SEND ORDER TO VENDOR
// ==========================
export const sendToVendor = async (order) => {
  try {
    if (!order?.network) {
      throw new Error("Missing network in order");
    }

    const network = order.network
      .trim()
      .toUpperCase();

    let result;

    switch (network) {
      case "MTN":
        result = await sendMTN(order);
        break;

      case "TELECEL":
        result = await sendTelecel(order);
        break;

      case "AIRTELTIGO":
        result = await sendAirtel(order);
        break;

      default:
        throw new Error(
          `Unsupported network: ${network}`
        );
    }

    // ==========================
    // NORMALIZE SUCCESS
    // ==========================
    const isSuccess =
      result?.success === true &&
      (!result?.status ||
        (result.status >= 200 &&
          result.status < 300));

    return {
      success: isSuccess,
      status: result?.status || null,
      state: isSuccess
        ? "sent"
        : "failed",

      message:
        result?.message ||
        result?.data?.message ||
        "No response",

      raw: result
    };

  } catch (err) {
    return {
      success: false,
      status: null,
      state: "failed",
      message: err.message
    };
  }
};

// ==========================
// FETCH STATUS FROM VENDOR
// ==========================
export const getVendorStatus = async (
  reference
) => {
  try {
    if (!reference) {
      throw new Error("Missing reference");
    }

    const url =
      `${process.env.VENDOR_STATUS_URL}/${reference}`;

    console.log(
      "📡 FETCHING VENDOR STATUS:",
      url
    );

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.VENDOR_API_KEY}`,
        "Content-Type":
          "application/json"
      },
      timeout: 15000
    });

    const data = res.data;

    console.log(
      "📡 STATUS RESPONSE:",
      data
    );

    const normalizedStatus = String(
      data?.status ||
      data?.state ||
      ""
    ).toLowerCase();

    return {
      success: true,

      status: normalizedStatus,

      message:
        data?.message ||
        data?.detail ||
        "No status message",

      raw: data
    };

  } catch (err) {
    console.log(
      "❌ STATUS FETCH ERROR:",
      err.response?.data || err.message
    );

    return {
      success: false,
      status: "unknown",
      message:
        err.response?.data?.message ||
        err.message
    };
  }
};