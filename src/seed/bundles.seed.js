import mongoose from "mongoose";
import dotenv from "dotenv";
import Bundle from "../models/Bundle.js";

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🔌 Connected to MongoDB");

    await Bundle.deleteMany({});
    console.log("🧹 Old bundles cleared");

    await Bundle.insertMany([

      // ================= MTN =================
      { network: "MTN", name: "1GB",  packageId: "MTN_1GB_001",  vendorPackageId: "mtn_1gb_basic" },
      { network: "MTN", name: "2GB",  packageId: "MTN_2GB_001",  vendorPackageId: "mtn_2gb_basic" },
      { network: "MTN", name: "3GB",  packageId: "MTN_3GB_001",  vendorPackageId: "mtn_3gb_basic" },
      { network: "MTN", name: "5GB",  packageId: "MTN_5GB_001",  vendorPackageId: "mtn_5gb_basic" },
      { network: "MTN", name: "10GB", packageId: "MTN_10GB_001", vendorPackageId: "mtn_10gb_pro" },
      { network: "MTN", name: "15GB", packageId: "MTN_15GB_001", vendorPackageId: "mtn_15gb_pro" },
      { network: "MTN", name: "20GB", packageId: "MTN_20GB_001", vendorPackageId: "mtn_20gb_pro" },

      // ================= TELECEL =================
      { network: "TELECEL", name: "1GB",  packageId: "TEL_1GB_001",  vendorPackageId: "tel_1gb_basic" },
      { network: "TELECEL", name: "2GB",  packageId: "TEL_2GB_001",  vendorPackageId: "tel_2gb_basic" },
      { network: "TELECEL", name: "3GB",  packageId: "TEL_3GB_001",  vendorPackageId: "tel_3gb_basic" },
      { network: "TELECEL", name: "5GB",  packageId: "TEL_5GB_001",  vendorPackageId: "tel_5gb_basic" },
      { network: "TELECEL", name: "10GB", packageId: "TEL_10GB_001", vendorPackageId: "tel_10gb_pro" },

      // ================= AIRTELTIGO =================
      { network: "AIRTELTIGO", name: "1GB",  packageId: "AIR_1GB_001",  vendorPackageId: "air_1gb_basic" },
      { network: "AIRTELTIGO", name: "2GB",  packageId: "AIR_2GB_001",  vendorPackageId: "air_2gb_basic" },
      { network: "AIRTELTIGO", name: "3GB",  packageId: "AIR_3GB_001",  vendorPackageId: "air_3gb_basic" },
      { network: "AIRTELTIGO", name: "5GB",  packageId: "AIR_5GB_001",  vendorPackageId: "air_5gb_basic" },
      { network: "AIRTELTIGO", name: "10GB", packageId: "AIR_10GB_001", vendorPackageId: "air_10gb_pro" }

    ]);

    console.log("✅ All bundles seeded successfully");
    process.exit(0);

  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  }
};

seed();