import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import crypto from "crypto";

/**
 * Helper to get and validate JWT_SECRET.
 * Evaluated lazily to avoid ESM hoisting issues where environment variables
 * might not be loaded yet during module initialization.
 */
let cachedSecret = null;
const getJwtSecret = () => {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = "CRITICAL: JWT_SECRET environment variable must be set (minimum 32 characters). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
    logger.error(error);
    throw new Error(error);
  }

  if (secret.length < 32) {
    const error = `CRITICAL: JWT_SECRET must be at least 32 characters long. Current length: ${secret.length}`;
    logger.error(error);
    throw new Error(error);
  }

  cachedSecret = secret;
  return cachedSecret;
};

export const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    logger.warn("Missing API key", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: "API key required in X-API-Key header", code: "MISSING_API_KEY" });
  }

  try {
    const expectedKey = process.env.API_KEY || "";
    
    // Hash both keys to a fixed length before timingSafeEqual to avoid 
    // "Input buffers must have the same length" errors.
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest();
    const expectedKeyHash = crypto.createHash('sha256').update(expectedKey).digest();

    const isValid = crypto.timingSafeEqual(
      apiKeyHash,
      expectedKeyHash
    );

    if (!isValid) {
      throw new Error("Invalid API key");
    }
  } catch (err) {
    logger.warn("Invalid API key attempt", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
  }

  // Log successful API access for audit
  logger.info("API key verified", {
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  next();
};

export const verifyJwt = (req, res, next) => {
  // Check Authorization header or the secure cookie
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.admin_token;

  if (!token) {
    logger.warn("Missing JWT token", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: "No token provided", code: "MISSING_TOKEN" });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    // ✅ CRITICAL FIX: Enhanced error handling with better context
    logger.warn("JWT verification failed", {
      error: err.message,
      name: err.name,
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    const statusCode = err.name === "TokenExpiredError" ? 401 : 401;
    return res.status(statusCode).json({ error: err.message || "Invalid token", code });
  }
};

export const generateToken = (payload) => {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};