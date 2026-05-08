/*
import axios from "axios";

const getTelecelBundlesUrl = () => {
  if (process.env.TELECEL_BUNDLES_URL) return process.env.TELECEL_BUNDLES_URL;
  if (!process.env.TELECEL_VENDOR_URL) return null;

  if (process.env.TELECEL_VENDOR_URL.includes("order")) {
    return process.env.TELECEL_VENDOR_URL.replace("order", "packages");
  }

  if (process.env.TELECEL_VENDOR_URL.includes("endpoint=")) {
    return process.env.TELECEL_VENDOR_URL.replace(/endpoint=[^&]+/, "endpoint=packages");
  }

  return `${process.env.TELECEL_VENDOR_URL}/packages`;
};

export const fetchTelecelBundles = async () => {
  try {
    const telecelUrl = getTelecelBundlesUrl();

    if (!telecelUrl) {
      throw new Error("TELECEL bundle URL is not configured");
    }

    const res = await axios.get(telecelUrl, {
      headers: {
        Authorization: `Bearer ${process.env.TELECEL_API_KEY}`
      }
    });

    const packages = res.data.data || res.data.packages || [];

    // 🔥 normalize vendor format → internal format
    return packages
      .filter(pkg => String(pkg.network || "").toUpperCase() === "TELECEL")
      .map(pkg => ({
        network: pkg.network || "TELECEL",
        name: pkg.name || pkg.size,
        vendorPackageId: pkg.id,
        price: pkg.price
      }));

  } catch (err) {
    console.log("❌ TELECEL SYNC ERROR:", err.message);
    return [];
  }
};

*/

/*

import axios from "axios";

const getTelecelBundlesUrl = () => {
  if (process.env.TELECEL_BUNDLES_URL) return process.env.TELECEL_BUNDLES_URL;
  if (!process.env.TELECEL_VENDOR_URL) return null;

  if (process.env.TELECEL_VENDOR_URL.includes("order")) {
    return process.env.TELECEL_VENDOR_URL.replace("order", "packages");
  }

  if (process.env.TELECEL_VENDOR_URL.includes("endpoint=")) {
    return process.env.TELECEL_VENDOR_URL.replace(/endpoint=[^&]+/, "endpoint=packages");
  }

  return `${process.env.TELECEL_VENDOR_URL}/packages`;
};

export const fetchTelecelBundles = async () => {
  try {
    const telecelUrl = getTelecelBundlesUrl();

    if (!telecelUrl) {
      throw new Error("TELECEL bundle URL is not configured");
    }

    const res = await axios.get(telecelUrl, {
      headers: {
        Authorization: `Bearer ${process.env.TELECEL_API_KEY}`
      }
    });

    const packages = res.data.data || res.data.packages || [];

    // 🔥 normalize vendor format → internal format
    return packages
      .filter(pkg => String(pkg.network || "").toUpperCase() === "TELECEL")
      .map(pkg => ({
        network: pkg.network || "TELECEL",
        name: pkg.name || pkg.size,
        vendorPackageId: pkg.id,
        price: pkg.price
      }));

  } catch (err) {
    console.log("❌ TELECEL SYNC ERROR:", err.message);
    return [];
  }
}; 


*/


import axios from "axios";

const getTelecelBundlesUrl = () => {
  // Explicit URL wins
  if (process.env.TELECEL_BUNDLES_URL) {
    return process.env.TELECEL_BUNDLES_URL;
  }

  // Auto-convert vendor order URL → packages URL
  if (!process.env.TELECEL_VENDOR_URL) {
    return null;
  }

  let url = process.env.TELECEL_VENDOR_URL;

  // order → packages
  if (url.includes("order")) {
    url = url.replace("order", "packages");
  }

  // endpoint=order → endpoint=packages
  if (url.includes("endpoint=")) {
    url = url.replace(
      /endpoint=[^&]+/,
      "endpoint=packages"
    );
  }

  // fallback
  if (!url.includes("packages")) {
    url += "/packages";
  }

  return url;
};

export const fetchTelecelBundles = async () => {
  try {
    const telecelUrl = getTelecelBundlesUrl();

    if (!telecelUrl) {
      throw new Error(
        "TELECEL_BUNDLES_URL not configured"
      );
    }

    console.log("📡 TELECEL PACKAGE URL:", telecelUrl);

    const res = await axios.get(telecelUrl, {
      headers: {
        Authorization: `Bearer ${process.env.TELECEL_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 15000
    });

    const packages =
      res.data?.data ||
      res.data?.packages ||
      res.data ||
      [];

    if (!Array.isArray(packages)) {
      throw new Error(
        "Invalid TELECEL package response format"
      );
    }

    console.log(
      "📦 TELECEL RAW SAMPLE:",
      packages[0]
    );

    // ==========================
    // NORMALIZE PACKAGE FORMAT
    // ==========================
    const normalized = packages
      .filter(pkg => {
        const network = String(
          pkg.network || ""
        ).toUpperCase();

        return network.includes("TELECEL");
      })
      .map(pkg => ({
        network: "TELECEL",

        // normalize bundle names
        name: String(
          pkg.name ||
          pkg.size ||
          pkg.bundle ||
          ""
        )
          .replace(/\s+/g, "")
          .toUpperCase(),

        // REAL vendor UUID
        vendorPackageId:
          pkg.package_id ||
          pkg.packageId ||
          pkg.uuid ||
          pkg.id,

        price: Number(pkg.price || 0)
      }))
      .filter(pkg => pkg.vendorPackageId);

    console.log(
      `✅ TELECEL PACKAGES NORMALIZED: ${normalized.length}`
    );

    return normalized;

  } catch (err) {
    console.log("❌ TELECEL SYNC ERROR");
    console.log(
      err.response?.data || err.message
    );

    return [];
  }
};