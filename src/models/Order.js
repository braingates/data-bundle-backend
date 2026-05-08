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
      enum: ["MTN", "TELECEL", "AIRTELTIGO"]
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
    // ORDER STATE (FIXED)
    // ==========================
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "retrying",
        "pending_vendor_balance"
      ],
      default: "pending",
      index: true
    },

    // ==========================
    // VENDOR STATE (FIXED)
    // ==========================
    vendorStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "sent",
        "success",
        "queued",
        "failed"
      ],
      default: "pending",
      index: true
    },

    // ==========================
    // RETRY SYSTEM
    // ==========================
    retryCount: {
      type: Number,
      default: 0
    },

    maxRetries: {
      type: Number,
      default: 4
    },

    lastRetryAt: {
      type: Date,
      default: null
    },

    nextRetryAt: {
      type: Date,
      default: null,
      index: true
    },

    processingStartedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    // ==========================
    // DEBUG / VENDOR RESPONSE
    // ==========================
    vendorResponse: {
      type: Object,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ==========================
// INDEXES (CRITICAL FOR SCALE)
// ==========================
orderSchema.index({
  paymentStatus: 1,
  vendorStatus: 1,
  orderStatus: 1
});

orderSchema.index({
  nextRetryAt: 1
});

export default mongoose.model("Order", orderSchema);