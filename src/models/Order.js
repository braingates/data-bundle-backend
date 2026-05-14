import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    },

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
        "failed"
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
      default: 0
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
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ paymentStatus: 1, vendorStatus: 1, orderStatus: 1 });
orderSchema.index({ nextRetryAt: 1 });
orderSchema.index({ "phone": 1, "createdAt": -1 });

orderSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Order", orderSchema);