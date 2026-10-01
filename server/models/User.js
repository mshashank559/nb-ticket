import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, default: 'password123' },
    role: { type: String, required: true },
    roleName: { type: String },
    department: { type: String },
    team: { type: String, default: '' },
    manager: { type: String, default: '' },
    managerId: { type: String, default: '' },
    managerEmail: { type: String, default: '' },
    status: { type: String, default: 'Active' },
    ticketsCount: { type: Number, default: 0 },
    createdAt: { type: String },
    // Security Protocol Fields
    weekendAccess: { type: Boolean, default: false },
    trustedDeviceId: { type: String, default: '' },
    trustedDeviceName: { type: String, default: '' },
    deviceEnrolledAt: { type: String, default: '' },
    deviceStatus: { type: String, default: 'ACTIVE' },
    lastLoginAt: { type: String, default: '' },
    lastLoginDevice: { type: String, default: '' },
  },
  { strict: false, timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
