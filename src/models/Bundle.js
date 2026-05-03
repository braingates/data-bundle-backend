import mongoose from "mongoose";

const bundleSchema = new mongoose.Schema({
  network: String,
  name: String,            // "1GB"
  packageId: String,       // vendor service/package identifier
  vendorPackageId: String, // legacy alias for packageId
  price: Number,

  isActive: {
    type: Boolean,
    default: true
  },

  lastSyncedAt: Date
});

export default mongoose.model("Bundle", bundleSchema);