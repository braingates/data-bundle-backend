import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // ==========================
    // IDENTIFIER
    // ==========================
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // ==========================
    // CUSTOMER DATA
    // ==========================
    phone: {
      type: String,
      required: true,
      index: true
    },

    network: {
      type: String,
      required: true,
      enum: ["MTN", "Telecel", "TELECEL", "AIRTELTIGO", "AirtelTigo"]
    },

    bundle: {
      type: String,
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // ==========================
    // PAYMENT STATE
    // ==========================
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      index: true
    },

    // ==========================
    // ORDER STATE
    // ==========================
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "delivered", "failed"],
      default: "pending",
      index: true
    },

    // ==========================
    // VENDOR STATE
    // ==========================
    vendorStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true
    },

    // ==========================
    // DEBUG / RESPONSE STORAGE
    // ==========================
    vendorResponse: {
      type: Object,
      default: null
    }
  },
  { timestamps: true }
);

// ==========================
// PERFORMANCE INDEXES
// ==========================

orderSchema.index({ paymentStatus: 1, vendorStatus: 1, orderStatus: 1 });





export default mongoose.model("Order", orderSchema);

