#!/usr/bin/env node

/**
 * Startup Verification Script
 * Checks all environment variables and configurations before starting the app
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment
const devEnvFile = path.join(__dirname, ".env.development");
const defaultEnvFile = path.join(__dirname, ".env");

if (existsSync(devEnvFile)) {
  dotenv.config({ path: devEnvFile });
  console.log("✅ Loaded .env.development");
} else if (existsSync(defaultEnvFile)) {
  dotenv.config({ path: defaultEnvFile });
  console.log("✅ Loaded .env");
} else {
  console.warn("⚠️  No .env file found");
}

// Verification
const checks = [];

// Critical checks
const criticalVars = ["JWT_SECRET", "API_KEY", "MONGO_URI"];
criticalVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    checks.push({ name: varName, status: "❌ MISSING", severity: "CRITICAL" });
  } else if (varName === "JWT_SECRET" && value.length < 32) {
    checks.push({ name: varName, status: `❌ TOO SHORT (${value.length} chars, need 32)`, severity: "CRITICAL" });
  } else {
    checks.push({ name: varName, status: "✅ SET", severity: "CRITICAL", value: value.substring(0, 10) + "..." });
  }
});

// Important checks
const importantVars = ["REDIS_URL", "PAYSTACK_SECRET", "API_SECRET"];
importantVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    checks.push({ name: varName, status: "⚠️  MISSING (optional)", severity: "HIGH" });
  } else {
    checks.push({ name: varName, status: "✅ SET", severity: "HIGH" });
  }
});

// Vendor checks
const vendorVars = ["MTN_VENDOR_URL", "TELECEL_VENDOR_URL", "AIRTEL_VENDOR_URL"];
vendorVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    checks.push({ name: varName, status: "⚠️  MISSING", severity: "MEDIUM" });
  } else {
    checks.push({ name: varName, status: "✅ SET", severity: "MEDIUM" });
  }
});

// Display results
console.log("\n" + "=".repeat(70));
console.log("STARTUP VERIFICATION REPORT");
console.log("=".repeat(70) + "\n");

const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [] };
checks.forEach(check => {
  bySeverity[check.severity].push(check);
});

let hasErrors = false;
let hasWarnings = false;

// CRITICAL
if (bySeverity.CRITICAL.length > 0) {
  console.log("🔴 CRITICAL CHECKS:");
  bySeverity.CRITICAL.forEach(c => {
    console.log(`  ${c.status} - ${c.name}`);
    if (c.status.includes("❌")) hasErrors = true;
  });
  console.log("");
}

// HIGH
if (bySeverity.HIGH.length > 0) {
  console.log("🟡 HIGH PRIORITY CHECKS:");
  bySeverity.HIGH.forEach(c => {
    console.log(`  ${c.status} - ${c.name}`);
    if (c.status.includes("⚠️")) hasWarnings = true;
  });
  console.log("");
}

// MEDIUM
if (bySeverity.MEDIUM.length > 0) {
  console.log("🔵 MEDIUM PRIORITY CHECKS:");
  bySeverity.MEDIUM.forEach(c => {
    console.log(`  ${c.status} - ${c.name}`);
  });
  console.log("");
}

console.log("=".repeat(70));

if (hasErrors) {
  console.log("\n❌ STARTUP FAILED - Critical environment variables missing!");
  console.log("\nTo fix:");
  console.log("  1. Copy .env.development file if it exists");
  console.log("  2. Or ensure .env file has all required variables");
  console.log("  3. Check JWT_SECRET is at least 32 characters\n");
  process.exit(1);
}

if (hasWarnings) {
  console.log("\n⚠️  WARNINGS - Some optional variables are missing");
  console.log("The application may not work fully without them.\n");
}

console.log("✅ STARTUP VERIFICATION PASSED - Ready to start server!\n");
process.exit(0);
