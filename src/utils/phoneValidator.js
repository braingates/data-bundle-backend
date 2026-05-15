/**
 * Phone number validation and network matching utility
 * Ghana networks: MTN (024, 054, 055), Telecel (027, 057), AirtelTigo (026, 056)
 */

export const NETWORK_PATTERNS = {
  MTN: {
    prefixes: ['024', '054', '055', '025', '059', '053'],
    regex: /^(024|054|055|025|059|053)\d{7}$/,
    name: 'MTN'
  },
  TELECEL: {
    prefixes: ['020', '050'],
    regex: /^(020|050)\d{7}$/,
    name: 'Telecel'
  },
  AIRTELTIGO: {
    prefixes: ['026', '056', '027', '057'],
    regex: /^(026|056|027|057)\d{7}$/,
    name: 'AirtelTigo'
  }
};

/**
 * Validate phone number format (Ghana)
 * @param {string} phone - Phone number (with or without +233 or 0)
 * @returns {object} { valid: boolean, normalized: string, network: string }
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: null, network: null, error: 'Invalid phone number' };
  }

  let normalized = phone.trim();

  // Remove common formatting
  normalized = normalized.replace(/[\s\-().+]/g, '');

  // Handle +233 format (convert to 0 format for consistency)
  if (normalized.startsWith('+233')) {
    normalized = '0' + normalized.substring(4);
  }

  // Handle 233 format without +
  if (normalized.startsWith('233') && !normalized.startsWith('+233')) {
    normalized = '0' + normalized.substring(3);
  }

  // Must be 10 digits starting with 0
  if (!/^0\d{9}$/.test(normalized)) {
    return { 
      valid: false, 
      normalized: null, 
      network: null, 
      error: 'Phone must be 10 digits (0XXXXXXXXX)' 
    };
  }

  // Detect network
  const detectedNetwork = detectNetwork(normalized);
  if (!detectedNetwork) {
    return { 
      valid: false, 
      normalized, 
      network: null, 
      error: 'Phone number does not match any known network' 
    };
  }

  return { 
    valid: true, 
    normalized, 
    network: detectedNetwork,
    error: null
  };
};

/**
 * Detect which network a phone number belongs to
 * @param {string} phone - Normalized phone number (0XXXXXXXXX format)
 * @returns {string|null} Network name (MTN, TELECEL, AIRTELTIGO) or null
 */
export const detectNetwork = (phone) => {
  if (!phone || typeof phone !== 'string') return null;

  const normalized = phone.trim();

  for (const [key, config] of Object.entries(NETWORK_PATTERNS)) {
    if (config.regex.test(normalized)) {
      return key;
    }
  }

  return null;
};

/**
 * Validate that phone number matches the specified network
 * @param {string} phone - Phone number
 * @param {string} expectedNetwork - Expected network (MTN, TELECEL, AIRTELTIGO)
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validatePhoneNetwork = (phone, expectedNetwork) => {
  if (!expectedNetwork || typeof expectedNetwork !== 'string') {
    return { valid: false, error: 'Network not specified' };
  }

  const validation = validatePhone(phone);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  const networkUpper = expectedNetwork.toUpperCase();
  if (!['MTN', 'TELECEL', 'AIRTELTIGO'].includes(networkUpper)) {
    return { valid: false, error: 'Invalid network specified' };
  }

  if (validation.network !== networkUpper) {
    return {
      valid: false,
      error: `This number does not match the selected ${networkUpper} network. Detected: ${validation.network}`
    };
  }

  return { valid: true, normalized: validation.normalized, network: validation.network, error: null };
};

/**
 * Get network display name
 * @param {string} network - Network key
 * @returns {string} Display name
 */
export const getNetworkDisplayName = (network) => {
  const config = NETWORK_PATTERNS[network?.toUpperCase()];
  return config ? config.name : network;
};

/**
 * Get valid prefixes for a network
 * @param {string} network - Network key
 * @returns {array} Array of valid prefixes
 */
export const getNetworkPrefixes = (network) => {
  const config = NETWORK_PATTERNS[network?.toUpperCase()];
  return config ? config.prefixes : [];
};

export default {
  validatePhone,
  detectNetwork,
  validatePhoneNetwork,
  getNetworkDisplayName,
  getNetworkPrefixes,
  NETWORK_PATTERNS
};
