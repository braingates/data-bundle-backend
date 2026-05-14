const formatMeta = (meta = {}) => {
  const keys = Object.keys(meta);
  return keys.length > 0 ? JSON.stringify(meta, null, 2) : "";
};

const logger = {
  info: (message, meta = {}) => {
    const metaStr = formatMeta(meta);
    console.log(
      `[INFO] ${new Date().toISOString()}: ${message}${metaStr ? "\n" + metaStr : ""}`
    );
  },

  error: (message, meta = {}) => {
    const metaStr = formatMeta(meta);
    console.error(
      `[ERROR] ${new Date().toISOString()}: ${message}${metaStr ? "\n" + metaStr : ""}`
    );
  },

  warn: (message, meta = {}) => {
    const metaStr = formatMeta(meta);
    console.warn(
      `[WARN] ${new Date().toISOString()}: ${message}${metaStr ? "\n" + metaStr : ""}`
    );
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== "production") {
      const metaStr = formatMeta(meta);
      console.debug(
        `[DEBUG] ${new Date().toISOString()}: ${message}${metaStr ? "\n" + metaStr : ""}`
      );
    }
  }
};

export default logger;