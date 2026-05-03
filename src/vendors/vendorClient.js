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