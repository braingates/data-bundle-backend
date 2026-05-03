import axios from "axios";

const getAirtelBundlesUrl = () => {
  if (process.env.AIRTEL_BUNDLES_URL) return process.env.AIRTEL_BUNDLES_URL;
  if (!process.env.AIRTEL_VENDOR_URL) return null;

  if (process.env.AIRTEL_VENDOR_URL.includes("order")) {
    return process.env.AIRTEL_VENDOR_URL.replace("order", "packages");
  }

  if (process.env.AIRTEL_VENDOR_URL.includes("endpoint=")) {
    return process.env.AIRTEL_VENDOR_URL.replace(/endpoint=[^&]+/, "endpoint=packages");
  }

  return `${process.env.AIRTEL_VENDOR_URL}/packages`;
};

export const fetchAirtelBundles = async () => {
  try {
    const airtelUrl = getAirtelBundlesUrl();

    if (!airtelUrl) {
      throw new Error("AIRTEL bundle URL is not configured");
    }

    const res = await axios.get(airtelUrl, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTEL_API_KEY}`
      }
    });

    const packages = res.data.data || res.data.packages || [];

    // 🔥 normalize vendor format → internal format
    return packages
      .filter(pkg => {
        const network = String(pkg.network || "").toUpperCase();
        return network.includes("AIRTELTIGO");
      })
      .map(pkg => ({
        network: "AIRTELTIGO",
        name: pkg.name || pkg.size,
        vendorPackageId: pkg.id,
        price: pkg.price
      }));

  } catch (err) {
    console.log("❌ AIRTEL SYNC ERROR:", err.message);
    return [];
  }
};