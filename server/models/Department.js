import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, index: true },
  roleId: { type: String, required: true, index: true },
  roleName: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#0ea5e9' },
  status: { type: String, default: 'Active' },
  createdBy: { type: String, default: 'Process Analyst' },
}, {
  timestamps: true,
  strict: false,
});

export const Department = mongoose.model('Department', DepartmentSchema);
