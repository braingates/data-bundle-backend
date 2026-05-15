import axios from "axios";

const getTelecelBundlesUrl = () => {
  if (process.env.TELECEL_BUNDLES_URL) return process.env.TELECEL_BUNDLES_URL;
  if (!process.env.TELECEL_VENDOR_URL) return null;

  let url = process.env.TELECEL_VENDOR_URL;
  if (url.includes("order")) url = url.replace("order", "packages");
  if (url.includes("endpoint=")) url = url.replace(/endpoint=[^&]+/, "endpoint=packages");
  if (!url.includes("packages")) url += "/packages";

  return url;
};

export const fetchTelecelBundles = async () => {
  try {
    const url = getTelecelBundlesUrl();
    if (!url) throw new Error("TELECEL_BUNDLES_URL not configured");

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.TELECEL_API_KEY}` },
      timeout: 15000
    });

    const packages = res.data?.data || res.data?.packages || res.data || [];

    return packages
      .filter(pkg => String(pkg.network || "").toUpperCase().includes("TELECEL"))
      .map(pkg => ({
        network: "TELECEL",
        name: String(pkg.name || pkg.size || pkg.bundle || "").replace(/\s+/g, "").toUpperCase(),
        vendorPackageId: pkg.package_id || pkg.packageId || pkg.uuid || pkg.id,
        price: Number(pkg.price || 0)
      }))
      .filter(pkg => pkg.vendorPackageId);
  } catch (err) {
    console.log("❌ TELECEL SYNC ERROR:", err.response?.data || err.message);
    return [];
  }
};