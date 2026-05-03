
import Bundle from "../models/Bundle.js";

const VENDOR_PACKAGE_FALLBACKS = {
  MTN: {
    "1GB": "mtn_1gb_basic",
    "2GB": "mtn_2gb_basic",
    "3GB": "mtn_3gb_basic",
    "5GB": "mtn_5gb_basic",
    "10GB": "mtn_10gb_pro",
    "15GB": "mtn_15gb_pro",
    "20GB": "mtn_20gb_pro"
  },
  TELECEL: {
    "1GB": "tel_1gb_basic",
    "2GB": "tel_2gb_basic",
    "3GB": "tel_3gb_basic",
    "5GB": "tel_5gb_basic",
    "10GB": "tel_10gb_pro"
  },
  AIRTELTIGO: {
    "1GB": "air_1gb_basic",
    "2GB": "air_2gb_basic",
    "3GB": "air_3gb_basic",
    "5GB": "air_5gb_basic",
    "10GB": "air_10gb_pro"
  }
};

export const getPackageId = async (network, bundleName) => {
  if (!network || !bundleName) {
    throw new Error("Network or bundleName missing");
  }

  const cleanNetwork = network.trim().toUpperCase();
  const cleanBundle = bundleName.trim().toUpperCase();

  const bundle = await Bundle.findOne({
    network: cleanNetwork,
    name: cleanBundle
  });

  if (!bundle) {
    console.log("❌ Bundle lookup failed:");
    console.log("Network:", cleanNetwork);
    console.log("Bundle:", cleanBundle);

    throw new Error(`Bundle not found: ${cleanNetwork} ${cleanBundle}`);
  }

  if (bundle.vendorPackageId) {
    return bundle.vendorPackageId;
  }

  const fallback = VENDOR_PACKAGE_FALLBACKS[cleanNetwork]?.[cleanBundle];

  if (fallback) {
    console.log(`ℹ️ Using fallback vendorPackageId for ${cleanNetwork} ${cleanBundle}: ${fallback}`);
    return fallback;
  }

  return bundle.packageId;
};