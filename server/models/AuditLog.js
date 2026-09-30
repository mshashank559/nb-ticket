import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    ticketId: { type: String, index: true },
    eventType: {
      type: String,
      required: true,
      // EMAIL_SENT, EMAIL_FAILED, INBOUND_EMAIL_RECEIVED, TICKET_NOTIFICATION_SENT,
      // ASSIGNMENT_EMAIL_SENT, RESOLUTION_EMAIL_SENT, REOPEN_EMAIL_SENT,
      // ESCALATION_EMAIL_SENT, SLA_REMINDER_SENT, SLA_BREACH_EMAIL_SENT, EXTENSION_EMAIL_SENT
    },
    actor: { type: String, default: 'System' },
    recipient: { type: String },
    subject: { type: String },
    messageId: { type: String },
    deliveryStatus: { type: String, default: 'sent' }, // queued, sending, sent, delivered, failed
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
