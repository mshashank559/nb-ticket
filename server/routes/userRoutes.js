import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Ticket } from '../models/Ticket.js';

const router = express.Router();

const initialSeedUsers = [
  {
    id: "USR-101",
    name: "Rudra Patel",
    email: "rudra.p@netbounceplacement.com",
    password: "MM@123",
    role: "manager",
    roleName: "Manager",
    department: "Executive Leadership",
    team: "Management",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "05 Jan 2026",
  },
  {
    id: "USR-106",
    name: "Shilp Patel",
    email: "shilp.p@netbounceplacement.com",
    password: "MM@123",
    role: "manager",
    roleName: "Manager",
    department: "Executive Leadership",
    team: "Management",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "05 Jan 2026",
  },
  {
    id: "USR-102",
    name: "Shashank Mishra",
    email: "mshashank559@gmail.com",
    password: "PA@123",
    role: "process_analyst",
    roleName: "Process Analyst",
    department: "Quality & Operations",
    team: "Quality & Operations",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "12 Jan 2026",
  },
  {
    id: "USR-107",
    name: "Aditi Mohapatra",
    email: "aditi.m@netbounceplacement.com",
    password: "PA@123",
    role: "process_analyst",
    roleName: "Process Analyst",
    department: "Quality & Operations",
    team: "Quality & Operations",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "10 Jan 2026",
  },
  {
    id: "USR-108",
    name: "Sneha Agrawal",
    email: "Sneha.a@netbounceplacement.com",
    password: "PA@123",
    role: "process_analyst",
    roleName: "Process Analyst",
    department: "Quality & Operations",
    team: "Quality & Operations",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "15 Jan 2026",
  },
  {
    id: "USR-103",
    name: "Mukesh Chaudhary",
    email: "mukesh.c@netbounceplacement.com",
    password: "TL@123",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    team: "Marketing",
    manager: "Shilp Patel",
    managerEmail: "shilp.p@netbounceplacement.com",
    status: "Active",
    ticketsCount: 0,
    createdAt: "01 Feb 2026",
  },
  {
    id: "USR-105",
    name: "Shivam Barot",
    email: "shivam.b@netbounceplacement.com",
    password: "TL@123",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    team: "Marketing",
    manager: "Shilp Patel",
    managerEmail: "shilp.p@netbounceplacement.com",
    status: "Active",
    ticketsCount: 0,
    createdAt: "05 Feb 2026",
  },
  {
    id: "USR-109",
    name: "Preet A",
    email: "preet.a@netbounceplacement.com",
    password: "preet@12",
    role: "sales_tl",
    roleName: "Sales TL",
    department: "Sales & Placement",
    team: "Sales",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "15 Jan 2026",
  },
  {
    id: "USR-104",
    name: "Nilesh Gurjar",
    email: "nilesh.g@netbounceplacement.com",
    password: "Sales@123",
    role: "sales_tl",
    roleName: "Sales TL",
    department: "Sales & Placement",
    team: "Sales",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "15 Jan 2026",
  },
  {
    id: "USR-110",
    name: "Ved Prakash Gupta",
    email: "vedprakash.g@netbounceplacement.com",
    password: "Sales@123",
    role: "sales_tl",
    roleName: "Sales TL",
    department: "Sales & Placement",
    team: "Sales",
    manager: "",
    managerEmail: "",
    status: "Active",
    ticketsCount: 0,
    createdAt: "15 Jan 2026",
  },
];

// Helper to ensure manager hierarchy is saved on all existing users
let migrationDone = false;
async function ensureManagerMapping() {
  if (migrationDone) return;
  try {
    // Strictly clear manager for sales_tl, process_analyst, and manager roles
    await User.updateMany(
      { role: { $in: ['sales_tl', 'process_analyst', 'manager'] } },
      { $set: { manager: '', managerEmail: '', managerId: '' } }
    );
    // Ensure Marketing TLs have Marketing Manager Shilp Patel
    await User.updateMany(
      { role: 'marketing_tl' },
      { $set: { manager: 'Shilp Patel', managerEmail: 'shilp.p@netbounceplacement.com', team: 'Marketing' } }
    );
    migrationDone = true;
  } catch (e) {
    console.error('ensureManagerMapping error:', e);
  }
}

// GET /api/users/sales-tls/active - Dedicated endpoint to query ACTIVE Sales TLs directly from database
router.get('/sales-tls/active', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const activeSeed = initialSeedUsers.filter(
        (u) => (u.role === 'sales_tl' || u.role === 'SALES_TL') && String(u.status || '').toLowerCase() === 'active'
      );
      return res.json(activeSeed);
    }
    await ensureManagerMapping();
    const salesTls = await User.find({
      role: { $in: ['sales_tl', 'SALES_TL'] },
      status: { $regex: /^active$/i },
    }).sort({ name: 1 });

    res.json(salesTls);
  } catch (error) {
    console.error('Error fetching active Sales TLs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users - List all users (Auto-seed if collection empty, supports ?role= & ?status=)
router.get('/', async (req, res) => {
  try {
    const queryFilter = {};
    if (req.query.role) {
      const roleVal = req.query.role.toLowerCase();
      queryFilter.$or = [
        { role: roleVal },
        { role: roleVal.toUpperCase() },
        { roleName: { $regex: new RegExp(`^${req.query.role}$`, 'i') } },
      ];
    }
    if (req.query.status) {
      queryFilter.status = { $regex: new RegExp(`^${req.query.status}$`, 'i') };
    }

    if (mongoose.connection.readyState !== 1) {
      let filtered = initialSeedUsers;
      if (req.query.role) {
        filtered = filtered.filter(u => u.role === req.query.role.toLowerCase());
      }
      if (req.query.status) {
        filtered = filtered.filter(u => String(u.status || '').toLowerCase() === req.query.status.toLowerCase());
      }
      return res.json(filtered);
    }
    await ensureManagerMapping();
    let users = await User.find(queryFilter).sort({ createdAt: 1 });
    if (users.length === 0 && Object.keys(queryFilter).length === 0) {
      try {
        await User.insertMany(initialSeedUsers, { ordered: false });
        console.log(`[Users Seeded] Authorized directory users seeded into MongoDB.`);
      } catch (seedErr) {}
      users = await User.find().sort({ createdAt: 1 });
    }

    // Compute dynamic real tickets count from MongoDB tickets collection
    try {
      const allTickets = await Ticket.find({}, 'assignee createdBy creatorName');
      const countMap = {};
      for (const t of allTickets) {
        if (t.assignee && t.assignee !== 'Unassigned') {
          countMap[t.assignee] = (countMap[t.assignee] || 0) + 1;
        }
        const creator = t.createdBy || t.creatorName;
        if (creator && creator !== t.assignee) {
          countMap[creator] = (countMap[creator] || 0) + 1;
        }
      }
      const usersWithDynamicCounts = users.map((u) => {
        const doc = u.toObject ? u.toObject() : { ...u };
        doc.ticketsCount = countMap[doc.name] || 0;
        return doc;
      });
      return res.json(usersWithDynamicCounts);
    } catch (countErr) {
      return res.json(users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.role && payload.role !== 'marketing_tl') {
      payload.manager = '';
      payload.managerEmail = '';
      payload.managerId = '';
    }
    const count = await User.countDocuments();
    const id = payload.id || `USR-${101 + count}`;
    const newUser = new User({
      ...payload,
      id,
      createdAt: payload.createdAt || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
    await newUser.save();
    console.log(`[User Created] ID: ${newUser.id}, Name: ${newUser.name}`);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update user in MongoDB
router.put('/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.role && payload.role !== 'marketing_tl') {
      payload.manager = '';
      payload.managerEmail = '';
      payload.managerId = '';
    }
    const updated = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: payload },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`[User Updated] ID: ${req.params.id}`);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Delete user permanently from MongoDB
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`[User Deleted] ID: ${req.params.id} removed from MongoDB.`);
    res.json({ message: 'User deleted successfully', user: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
