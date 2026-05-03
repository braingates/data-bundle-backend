import axios from "axios";

const getMtnBundlesUrl = () => {
  if (process.env.MTN_BUNDLES_URL) return process.env.MTN_BUNDLES_URL;
  if (!process.env.MTN_VENDOR_URL) return null;

  if (process.env.MTN_VENDOR_URL.includes("order")) {
    return process.env.MTN_VENDOR_URL.replace("order", "packages");
  }

  if (process.env.MTN_VENDOR_URL.includes("endpoint=")) {
    return process.env.MTN_VENDOR_URL.replace(/endpoint=[^&]+/, "endpoint=packages");
  }

  return `${process.env.MTN_VENDOR_URL}/packages`;
};

export const fetchMTNBundles = async () => {
  try {
    const mtbUrl = getMtnBundlesUrl();

    if (!mtbUrl) {
      throw new Error("MTN bundle URL is not configured");
    }

    const res = await axios.get(mtbUrl, {
      headers: {
        Authorization: `Bearer ${process.env.MTN_API_KEY}`
      }
    });

    const packages = res.data.data || res.data.packages || [];

    // 🔥 normalize vendor format → internal format
    return packages
      .filter(pkg => String(pkg.network || "").toUpperCase() === "MTN")
      .map(pkg => ({
        network: pkg.network || "MTN",
        name: pkg.name || pkg.size,
        vendorPackageId: pkg.id,
        price: pkg.price
      }));

  } catch (err) {
    console.log("❌ MTN SYNC ERROR:", err.message);
    return [];
  }
};