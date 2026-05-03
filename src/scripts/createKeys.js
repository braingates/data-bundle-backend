import { generateApiCredentials } from "../utils/generateKeys.js";

const keys = generateApiCredentials();

console.log("YOUR API KEYS:");
console.log("API KEY:", keys.apiKey);
console.log("API SECRET:", keys.apiSecret);