import crypto from "crypto";

// Generate API Key
export const generateApiKey = () => {
  return `mbst_live_${crypto.randomBytes(12).toString("hex")}`;
};

// Generate Secret Key
export const generateApiSecret = () => {
  return `mbst_secret_${crypto.randomBytes(24).toString("hex")}`;
};

// Generate both together
export const generateApiCredentials = () => {
  return {
    apiKey: generateApiKey(),
    apiSecret: generateApiSecret()
  };
};