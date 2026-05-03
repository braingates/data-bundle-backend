export const normalizeVendorResponse = (network, response) => {
  try {
    return {
      success: response?.success === true,

      message:
        response?.data?.message ||
        response?.message ||
        response?.error?.message ||
        response?.error ||
        "Unknown vendor response",

      raw: response
    };
  } catch (err) {
    return {
      success: false,
      message: "Normalization failed",
      raw: response
    };
  }
};