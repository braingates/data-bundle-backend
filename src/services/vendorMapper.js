export const VENDOR_MAP = {
  MTN: {
    "1GB": "REAL_MTN_1GB_ID",
    "2GB": "REAL_MTN_2GB_ID",
    "3GB": "REAL_MTN_3GB_ID",
    "4GB": "REAL_MTN_4GB_ID",
    "5GB": "REAL_MTN_5GB_ID",
    "6GB": "REAL_MTN_6GB_ID",
    "8GB": "REAL_MTN_8GB_ID",
    "10GB": "REAL_MTN_10GB_ID",
    "12GB": "REAL_MTN_12GB_ID",
    "15GB": "REAL_MTN_15GB_ID",
    "20GB": "REAL_MTN_20GB_ID",
    "25GB": "REAL_MTN_25GB_ID",
    "30GB": "REAL_MTN_30GB_ID",
    "35GB": "REAL_MTN_35GB_ID",
    "40GB": "REAL_MTN_40GB_ID",
    "45GB": "REAL_MTN_45GB_ID",
    "50GB": "REAL_MTN_50GB_ID"
    
  },

  TELECEL: {
    "2GB": "TEL_2GB_ID",
    "3GB": "TEL_3GB_ID",
    "5GB": "TEL_5GB_ID",
    "10GB": "TEL_10GB_ID",
    "15GB": "TEL_15GB_ID",
    "20GB": "TEL_20GB_ID",
    "25GB": "TEL_25GB_ID",
    "30GB": "TEL_30GB_ID",
    "35GB": "TEL_35GB_ID",
    "40GB": "TEL_40GB_ID",
    "45GB": "TEL_45GB_ID",
    "50GB": "TEL_50GB_ID"
  },

  AIRTELTIGO: {
    "1GB": "AIR_1GB_ID",
    "2GB": "AIR_2GB_ID",
    "3GB": "AIR_3GB_ID",
    "4GB": "AIR_4GB_ID",
    "5GB": "AIR_1GB_ID",
    "6GB": "AIR_2GB_ID",
    "7GB": "AIR_3GB_ID",
    "8GB": "AIR_4GB_ID",
    "9GB": "AIR_9GB_ID",
    "10GB": "AIR_10GB_ID",
    "12GB": "AIR_12GB_ID",
    "15GB": "AIR_15GB_ID",
    "20GB": "AIR_20GB_ID",
    "25GB": "AIR_25GB_ID",
    "30GB": "AIR_30GB_ID",
    "35GB": "AIR_35GB_ID",
    "40GB": "AIR_40GB_ID",
    "45GB": "AIR_45GB_ID",
    "50GB": "AIR_50GB_ID"
    
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