import axios from "axios";
import Bundle from "../models/Bundle.js";

// ==========================
// MTN
// ==========================
export const syncMTN = async () => {
  try {
    console.log("🔄 Starting MTN sync...");

    const url = process.env.MTN_VENDOR_URL.replace("order", "packages");

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.MTN_API_KEY}`
      }
    });

    const packages = res.data.data || res.data.packages || [];

    if (!Array.isArray(packages)) {
      throw new Error("Invalid MTN packages response");
    }

    let count = 0;

    for (const pkg of packages) {
      if (String(pkg.network || "").toUpperCase() !== "MTN") continue;

      await Bundle.findOneAndUpdate(
        {
          network: "MTN",
          name: pkg.name
        },
        {
          network: "MTN",
          name: pkg.name,
          price: pkg.price,
          packageId: pkg.id
        },
        { upsert: true }
      );

      count++;
    }

    console.log(`✅ MTN synced: ${count} bundles`);

  } catch (err) {
    console.error("❌ MTN SYNC ERROR:", err.message);
  }
};
// ==========================
// TELECEL
// ==========================
export const syncTelecel = async () => {
  try {
    const res = await axios.get(process.env.TELECEL_BUNDLES_URL, {
      headers: {
        "x-api-key": process.env.TELECEL_API_KEY,
        "x-api-secret": process.env.TELECEL_API_SECRET
      }
    });

    const packages = res.data.data || res.data;

    for (const pkg of packages) {
      await Bundle.findOneAndUpdate(
        { network: "TELECEL", name: pkg.name },
        {
          price: pkg.price,
          packageId: pkg.id
        },
        { upsert: true }
      );
    }

    console.log("✅ Telecel bundles synced");

  } catch (err) {
    console.error("❌ Telecel sync error:", err.message);
  }
};

// ==========================
// AIRTELTIGO
// ==========================
export const syncAirtelTigo = async () => {
  try {
    const res = await axios.get(process.env.AIRTEL_BUNDLES_URL, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTEL_API_KEY}`
      }
    });

    const packages = res.data.data || res.data;

    for (const pkg of packages) {
      await Bundle.findOneAndUpdate(
        { network: "AIRTELTIGO", name: pkg.name },
        {
          price: pkg.price,
          packageId: pkg.id
        },
        { upsert: true }
      );
    }

    console.log("✅ AirtelTigo bundles synced");

  } catch (err) {
    console.error("❌ AirtelTigo sync error:", err.message);
  }
};