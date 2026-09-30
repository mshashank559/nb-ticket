import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

const router = express.Router();

const initialSeedUsers = [
  {
    id: "USR-ADMIN",
    name: "Shashank M",
    email: "shashank.m@netbounceplacement.com",
    password: "password123",
    role: "process_analyst",
    roleName: "Process Analyst & Admin",
    department: "Quality & Operations",
    status: "Active",
    ticketsCount: 0,
    createdAt: "28 Sept 2026",
  },
  {
    id: "USR-101",
    name: "Amit Verma",
    email: "amit.verma@netbounce.com",
    role: "process_analyst",
    roleName: "Process Analyst",
    department: "Quality & Operations",
    status: "Active",
    ticketsCount: 0,
    createdAt: "10 Jan 2026",
  },
  {
    id: "USR-102",
    name: "Shilp Mehta",
    email: "shilp.mehta@netbounce.com",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    status: "Active",
    ticketsCount: 0,
    createdAt: "12 Jan 2026",
  },
  {
    id: "USR-103",
    name: "Rohit Verma",
    email: "rohit.verma@netbounce.com",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    status: "Active",
    ticketsCount: 0,
    createdAt: "01 Feb 2026",
  },
  {
    id: "USR-104",
    name: "Rohan Sen",
    email: "rohan.sen@netbounce.com",
    role: "sales_tl",
    roleName: "Sales TL",
    department: "Sales & Placement",
    status: "Active",
    ticketsCount: 0,
    createdAt: "15 Jan 2026",
  },
  {
    id: "USR-105",
    name: "Priya Nair",
    email: "priya.nair@netbounce.com",
    role: "sales_tl",
    roleName: "Sales TL",
    department: "Sales & Placement",
    status: "Active",
    ticketsCount: 0,
    createdAt: "05 Feb 2026",
  },
  {
    id: "USR-106",
    name: "Kavita Rao",
    email: "kavita.rao@netbounce.com",
    role: "manager",
    roleName: "Manager",
    department: "Executive Leadership",
    status: "Active",
    ticketsCount: 0,
    createdAt: "05 Jan 2026",
  },
];

// GET /api/users - List all users (Auto-seed if collection empty)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(initialSeedUsers);
    }
    let users = await User.find().sort({ createdAt: 1 });
    if (users.length === 0) {
      try {
        await User.insertMany(initialSeedUsers, { ordered: false });
        console.log(`[Users Seeded] 6 Authorized directory users seeded into MongoDB.`);
      } catch (seedErr) {
        // Ignore duplicate key errors if concurrent request already seeded
      }
      users = await User.find().sort({ createdAt: 1 });
    }
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const count = await User.countDocuments();
    const id = req.body.id || `USR-${101 + count}`;
    const newUser = new User({
      ...req.body,
      id,
      createdAt: req.body.createdAt || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
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
    const updated = await User.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
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
