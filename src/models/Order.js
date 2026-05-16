import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true
    },
    shortTrackingId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true
    },

    idempotencyKey: {
      type: String,
      sparse: true,
      index: true
    },

    phone: {
      type: String,
      required: true,
      index: true
    },

    network: {
      type: String,
      required: true,
      enum: ["MTN", "TELECEL", "AIRTELTIGO"],
      index: true
    },

    bundle: {
      type: String,
      required: true
    },

    packageId: String,

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    vendorCost: {
      type: Number,
      default: 0
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
      index: true
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "delivered",
        "failed",
        "retrying",
        "pending_vendor_balance"
      ],
      default: "pending",
      index: true
    },

    vendorStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "sent",
        "success",
        "queued",
        "failed",
        "completed" // Add 'completed' to vendorStatus enum
      ],
      default: "pending",
      index: true
    },

    vendorReference: {
      type: String,
      index: true
    },

    vendorResponse: {
      type: Object,
      default: null
    },

    retryCount: {
      type: Number,
      default: 0,
      index: true
    },

    maxRetries: {
      type: Number,
      default: 4
    },

    lastRetryAt: Date,

    nextRetryAt: {
      type: Date,
      default: null,
      index: true
    },

    processingStartedAt: Date,

    completedAt: Date,

    failureReason: String,

    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// ✅ CRITICAL FIX: Add compound indexes for common queries
orderSchema.index({ paymentStatus: 1, vendorStatus: 1, orderStatus: 1 });
orderSchema.index({ nextRetryAt: 1, retryCount: 1 });
orderSchema.index({ phone: 1, createdAt: -1 });
orderSchema.index({ phone: 1, network: 1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ vendorStatus: 1, createdAt: -1 });

// ✅ CRITICAL FIX: Add TTL index to automatically delete old failed orders after 90 days
orderSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 7776000, // 90 days in seconds
    partialFilterExpression: {
      $or: [
        { orderStatus: "failed" },
        { paymentStatus: "failed" }
      ]
    }
  }
);

// ✅ FIX: Remove duplicate updatedAt logic (timestamps: true handles this)
orderSchema.pre("save", function(next) {
  // timestamps: true automatically sets updatedAt, no need to do it here
  next();
});

export default mongoose.model("Order", orderSchema);