export const VENDOR_MAP = {
  MTN: {
    "1GB": "REAL_MTN_1GB_ID",
    "2GB": "REAL_MTN_2GB_ID",
    "5GB": "REAL_MTN_5GB_ID"
  },

  TELECEL: {
    "1GB": "TEL_1GB_ID",
    "2GB": "TEL_2GB_ID"
  },

  AIRTELTIGO: {
    "1GB": "AIR_1GB_ID",
    "2GB": "AIR_2GB_ID",
    "1GB": "AIR_1GB_ID",
    "2GB": "AIR_2GB_ID",
  }
};

export const resolvePackageId = (network, bundle) => {
  const map = VENDOR_MAP[network];

  if (!map) {
    throw new Error(`No vendor mapping for network: ${network}`);
  }

  const packageId = map[bundle];

  if (!packageId) {
    throw new Error(`No package mapping: ${network} ${bundle}`);
  }

  return packageId;
};