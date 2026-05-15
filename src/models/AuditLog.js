import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: String,
  orderId: String,
  userId: String,
  changes: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now, index: true }
});

auditSchema.index({ orderId: 1, timestamp: -1 });
auditSchema.index({ action: 1, timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditSchema);

export const auditLogger = {
  log: async (data) => {
    try {
      await AuditLog.create({
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        orderId: data.orderId,
        userId: data.userId,
        changes: data.changes,
        metadata: data.metadata,
        ip: data.ip,
        userAgent: data.userAgent
      });
    } catch (err) {
      console.error("Audit log error:", err.message);
    }
  },

  getByOrder: async (orderId) => {
    return AuditLog.find({ orderId }).sort({ timestamp: -1 });
  },

  getByAction: async (action, limit = 100) => {
    return AuditLog.find({ action }).sort({ timestamp: -1 }).limit(limit);
  }
};

export default AuditLog;