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
    status: { type: String, default: 'Active' },
    ticketsCount: { type: Number, default: 0 },
    createdAt: { type: String },
  },
  { strict: false, timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
