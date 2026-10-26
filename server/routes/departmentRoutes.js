import express from 'express';
import { Department } from '../models/Department.js';

const router = express.Router();

const DEFAULT_DEPARTMENTS = [
  {
    id: 'DEP-MKT',
    name: 'Marketing',
    slug: 'marketing',
    roleId: 'marketing_tl',
    roleName: 'Marketing TL',
    description: 'Marketing & Lead Generation complaints, candidate interview queries, recruiter requests.',
    color: '#2563eb',
    status: 'Active',
    createdBy: 'System Default',
  },
  {
    id: 'DEP-SALES',
    name: 'Sales',
    slug: 'sales',
    roleId: 'sales_tl',
    roleName: 'Sales TL',
    description: 'Sales & Placement custom issues, client feedback, rate coordination.',
    color: '#0ea5a4',
    status: 'Active',
    createdBy: 'System Default',
  },
  {
    id: 'DEP-LEAD',
    name: 'Lead Team',
    slug: 'lead',
    roleId: 'lead_tl',
    roleName: 'Lead TL',
    description: 'Lead generation, inbound inquiry review, cross-team assignment and operational complaints.',
    color: '#8b5cf6',
    status: 'Active',
    createdBy: 'System Default',
  },
  {
    id: 'DEP-OPS',
    name: 'Quality & Operations',
    slug: 'quality_ops',
    roleId: 'process_analyst',
    roleName: 'Process Analyst',
    description: 'Central review, assignment governance, SLA escalation, and user management.',
    color: '#f59e0b',
    status: 'Active',
    createdBy: 'System Default',
  },
];

// Helper to seed default departments if table is empty
async function ensureDefaultDepartments() {
  try {
    const count = await Department.countDocuments();
    if (count === 0) {
      await Department.insertMany(DEFAULT_DEPARTMENTS);
    }
  } catch (err) {
    console.warn('[Department seed warning]:', err.message);
  }
}

// GET /api/departments - List all active departments
router.get('/', async (req, res) => {
  try {
    await ensureDefaultDepartments();
    const list = await Department.find({ status: { $ne: 'Archived' } }).sort({ createdAt: 1 }).lean();
    res.json(list.length > 0 ? list : DEFAULT_DEPARTMENTS);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: err.message, fallback: DEFAULT_DEPARTMENTS });
  }
});

// POST /api/departments - Create a new department (Only Process Analyst)
router.post('/', async (req, res) => {
  try {
    const { name, roleName, description, color, createdBy } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const trimmedName = name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const roleId = `${slug}_tl`;
    const resolvedRoleName = roleName && roleName.trim() ? roleName.trim() : `${trimmedName} TL`;

    // Check existing
    const existing = await Department.findOne({
      $or: [
        { name: new RegExp(`^${trimmedName}$`, 'i') },
        { slug },
        { roleId },
      ],
    });

    if (existing) {
      return res.status(409).json({ error: 'A department with this name or slug already exists' });
    }

    const nextId = `DEP-${Date.now().toString().slice(-4)}`;
    const newDept = await Department.create({
      id: nextId,
      name: trimmedName,
      slug,
      roleId,
      roleName: resolvedRoleName,
      description: description ? description.trim() : '',
      color: color || '#8b5cf6',
      status: 'Active',
      createdBy: createdBy || 'Process Analyst',
    });

    res.status(201).json(newDept);
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/departments/:id - Archive or delete department
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (['DEP-MKT', 'DEP-SALES', 'DEP-OPS'].includes(id)) {
      return res.status(400).json({ error: 'Core system departments cannot be deleted' });
    }

    const deleted = await Department.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ success: true, message: 'Department removed successfully', id });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
