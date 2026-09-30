import express from 'express';
import { Notification } from '../models/Notification.js';

const router = express.Router();

// GET /api/notifications - List all notifications
router.get('/', async (req, res) => {
  try {
    const notifs = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { id: req.params.id },
      { $set: { unread: false } },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({}, { $set: { unread: false } });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notifications/clear-all - Delete all notifications
router.delete('/clear-all', async (req, res) => {
  try {
    const result = await Notification.deleteMany({});
    res.json({ message: 'Notifications cleared', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
