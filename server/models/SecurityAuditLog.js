import mongoose from 'mongoose';

const SecurityAuditLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userId: { type: String },
    userName: { type: String },
    userRole: { type: String },
    eventType: {
      type: String,
      required: true,
      enum: [
        'WEEKEND_ACCESS_GRANTED',
        'WEEKEND_ACCESS_REVOKED',
        'DEVICE_ENROLLED',
        'DEVICE_RESET',
        'DEVICE_REVOKED',
        'ACCESS_DENIED_MOBILE',
        'ACCESS_DENIED_HOURS',
        'ACCESS_DENIED_WEEKEND',
        'ACCESS_DENIED_DEVICE',
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
      ],
    },
    performedBy: {
      id: { type: String },
      name: { type: String },
      role: { type: String },
      email: { type: String },
    },
    reason: { type: String, default: '' },
    ip: { type: String, default: '' },
    deviceInfo: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const SecurityAuditLog = mongoose.model('SecurityAuditLog', SecurityAuditLogSchema);
