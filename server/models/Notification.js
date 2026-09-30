import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    ticketId: { type: String, index: true },
    recipientEmail: { type: String },
    recipientRole: { type: String },
    type: { type: String, default: 'General' }, // Created, Open, Assigned, Reminder, Escalated, Closed, Re-Opened, Extension, Reply, Breach
    title: { type: String, required: true },
    detail: { type: String, required: true },
    time: { type: String, default: 'Just now' },
    unread: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const Notification = mongoose.model('Notification', NotificationSchema);
