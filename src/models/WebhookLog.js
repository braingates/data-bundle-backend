import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      index: true
    },
    event: {
      type: String,
      default: "charge.success"
    },
    paystackTimestamp: Date,
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    // Auto-delete webhook logs after 24 hours (TTL index)
    // This prevents the collection from growing indefinitely
    expireAfterSeconds: 86400
  }
);

// Compound index to prevent duplicate processing
webhookLogSchema.index({ reference: 1, createdAt: -1 });

export default mongoose.model("WebhookLog", webhookLogSchema);
