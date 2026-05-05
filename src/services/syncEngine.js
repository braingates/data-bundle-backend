import Bundle from "../models/Bundle.js";

import { fetchMTNBundles } from "./vendorAdapters/mtnAdapter.js";
import { fetchTelecelBundles } from "./vendorAdapters/telecelAdapter.js";
import { fetchAirtelBundles } from "./vendorAdapters/airteltigoAdapter.js";

export const syncBundles = async () => {
  console.log("🔄 Starting bundle sync...");

  try {
    const allBundles = [
      ...(await fetchMTNBundles()),
      ...(await fetchTelecelBundles()),
      ...(await fetchAirtelBundles())
    ];

    if (!allBundles.length) {
      console.log("⚠️ No bundles fetched");
      return false;
    }

    for (const bundle of allBundles) {
      await Bundle.findOneAndUpdate(
        {
          network: bundle.network,
          name: bundle.name
        },
        {
          ...bundle,
          lastSyncedAt: new Date(),
          isActive: true
        },
        {
          upsert: true,
          new: true
        }
      );
    }

    console.log(`✅ Synced ${allBundles.length} bundles`);
    return true;

  } catch (err) {
    console.log("❌ SYNC ENGINE ERROR:", err.message);
    return false;
  }
};



