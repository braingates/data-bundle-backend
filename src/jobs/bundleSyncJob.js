import cron from "node-cron";
import { syncBundles } from "../services/syncEngine.js";

console.log("📦 Bundle sync job started");

export const startBundleSyncJob = async () => {
  console.log("🔄 Running initial bundle sync before startup...");

  const success = await syncBundles();
  if (!success) {
    throw new Error("Initial bundle sync failed");
  }

  cron.schedule("*/10 * * * *", async () => {
    await syncBundles();
  });
};