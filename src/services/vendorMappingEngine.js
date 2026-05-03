import Bundle from "../models/Bundle.js";

/**
 * ==========================
 * GET PACKAGE ID FROM DB
 * ==========================
 */
export const getPackageId = async (network, bundle) => {
  try {
    if (!network || !bundle) {
      throw new Error("Missing network or bundle");
    }

    const cleanNetwork = network.toUpperCase().trim();
    const cleanBundle = bundle.toUpperCase().trim();

    console.log("🔍 Mapping lookup:", { cleanNetwork, cleanBundle });

    const record = await Bundle.findOne({
      network: cleanNetwork,
      name: cleanBundle
    });

    if (!record) {
      console.error("❌ MISSING MAPPING:", {
        network: cleanNetwork,
        bundle: cleanBundle
      });

      throw new Error(`Bundle not mapped: ${cleanNetwork} ${cleanBundle}`);
    }

    return record.packageId || record.vendorPackageId;

  } catch (err) {
    console.error("❌ Mapping Engine Error:", err.message);

    return null;
  }
};