import express from 'express';
import mongoose from 'mongoose';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { emailService } from '../services/emailService.js';

const router = express.Router();

// Helper to format remaining time or deadline
const calcSLARemaining = (deadline) => {
  if (!deadline) return 'Not Started';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Breached';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
};

// GET /api/tickets - List all tickets (newest activity / created on top)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const tickets = await Ticket.find().sort({ updatedAt: -1, createdAt: -1 });
    // Recalculate dynamic SLA string & status
    const mapped = tickets.map(t => {
      const doc = t.toObject();
      if (doc.status !== 'Resolved' && doc.status !== 'Closed' && doc.slaDeadline) {
        const diff = new Date(doc.slaDeadline).getTime() - Date.now();
        if (diff <= 0) {
          doc.slaState = 'breached';
          doc.sla = 'Breached';
          doc.slaBreached = true;
        } else if (diff < 3600 * 1000) {
          doc.slaState = 'due';
          doc.sla = calcSLARemaining(doc.slaDeadline);
        } else {
          doc.slaState = 'healthy';
          doc.sla = calcSLARemaining(doc.slaDeadline);
        }
      }
      return doc;
    });
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/tickets/:id or PATCH /api/tickets/:id - General update
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.createdAt;
    delete updateData.updatedAt;
    const updated = await Ticket.findOneAndUpdate({ id: req.params.id }, updateData, { new: true, upsert: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.createdAt;
    delete updateData.updatedAt;
    const updated = await Ticket.findOneAndUpdate({ id: req.params.id }, updateData, { new: true });
    if (!updated) return res.status(404).json({ error: 'Ticket not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tickets/:id - Single ticket
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ id: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tickets - Create ticket
router.post('/', async (req, res) => {
  try {
    let nextId = req.body.id;
    if (!nextId) {
      // Find highest ticket number or count
      const count = await Ticket.countDocuments();
      const lastTicket = await Ticket.findOne({ id: /^TIC-/ }).sort({ createdAt: -1 });
      if (lastTicket && lastTicket.id) {
        const num = parseInt(lastTicket.id.replace('TIC-', ''), 10);
        nextId = `TIC-${isNaN(num) ? count + 1001 : num + 1}`;
      } else {
        nextId = `TIC-${1001 + count}`;
      }
    }

    const reqBody = { ...req.body };
    delete reqBody.createdAt;
    delete reqBody.updatedAt;

    const rawTimeline = Array.isArray(req.body.timeline) && req.body.timeline.length ? req.body.timeline : [];
    const formattedTimeline = rawTimeline.length
      ? rawTimeline.map((item) => ({
          title: item.title || item.action || 'Ticket Created',
          detail: item.detail || `Created by ${req.body.createdBy || req.body.creatorName || 'User'}`,
          time: item.time || 'Just now',
          type: item.type || 'creation',
        }))
      : [
          {
            title: 'Ticket Created',
            detail: `Created by ${req.body.creatorName || req.body.creatorRole || req.body.createdBy || 'User'} (${req.body.team || 'NetBounce'})`,
            time: 'Just now',
            type: 'creation',
          },
        ];

    let targetAssignee = req.body.assignee && req.body.assignee !== 'Unassigned' ? req.body.assignee : (req.body.recruiter || 'Unassigned');
    let targetAssigneeRole = req.body.assigneeRole || '';
    if (targetAssignee && targetAssignee !== 'Unassigned' && !targetAssigneeRole) {
      try {
        const u = await User.findOne({ name: targetAssignee });
        if (u) targetAssigneeRole = u.role;
      } catch (e) {}
      if (!targetAssigneeRole) {
        targetAssigneeRole = (req.body.team === 'Sales' || req.body.creatorRole === 'sales_tl') ? 'marketing_tl' : 'sales_tl';
      }
    }

    const isDirectlyAssigned = targetAssignee && targetAssignee !== 'Unassigned';
    const now = new Date();
    const deadline = isDirectlyAssigned ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;

    const payload = {
      ...reqBody,
      id: nextId,
      status: req.body.status || (isDirectlyAssigned ? 'In Progress' : 'New'),
      assignee: targetAssignee,
      assigneeRole: targetAssigneeRole,
      targetTeam: req.body.targetTeam || (targetAssigneeRole === 'marketing_tl' ? 'Marketing' : targetAssigneeRole === 'sales_tl' ? 'Sales' : req.body.team || 'Marketing'),
      assignedAt: isDirectlyAssigned ? (req.body.assignedAt || now) : null,
      assignedBy: isDirectlyAssigned ? (req.body.assignedBy || req.body.createdBy || 'Originating Team Lead') : '',
      slaDeadline: deadline,
      slaState: isDirectlyAssigned ? 'healthy' : (req.body.slaState || 'unassigned'),
      sla: isDirectlyAssigned ? '24h 00m' : (req.body.sla || 'Not Started'),
      timeline: isDirectlyAssigned ? [
        {
          title: 'Assigned to Team Lead',
          detail: `Assigned directly to ${targetAssignee} (${targetAssigneeRole === 'marketing_tl' ? 'Marketing TL' : 'Sales TL'}). 24-hour resolution SLA activated.`,
          time: 'Just now',
          type: 'assignment',
        },
        ...formattedTimeline,
      ] : formattedTimeline,
    };

    const newTicket = new Ticket(payload);
    await newTicket.save();
    console.log(`[Ticket Created] ID: ${newTicket.id} AssignedTo: ${newTicket.assignee}`);

    // Emit live WebSocket update so all connected users see it immediately at the top
    try {
      req.app?.get('io')?.emit('ticket_created', newTicket);
      req.app?.get('io')?.emit('tickets_changed');
    } catch (e) {}

    // Fire Created Notification & Email from Centralized Support Email
    emailService
      .sendTicketNotification('created', newTicket, {
        raisedBy: newTicket.createdBy || newTicket.creatorName || 'Team Lead',
        originatingTeam: newTicket.team || 'Originating Team',
      })
      .catch((err) => console.error('[Ticket Created] Notification error:', err.message));

    res.status(201).json(newTicket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/assign - Assign to Team Lead and start 24h SLA
router.patch('/:id/assign', async (req, res) => {
  try {
    const { assignee, paName, assigneeRole: explicitRole } = req.body;
    let resolvedRole = explicitRole;
    if (!resolvedRole && assignee) {
      try {
        const u = await User.findOne({ name: assignee });
        if (u) resolvedRole = u.role;
      } catch (e) {}
      if (!resolvedRole) {
        resolvedRole = 'marketing_tl';
      }
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newTimelineItem = {
      title: 'Assigned to Team Lead',
      detail: `Assigned to ${assignee || 'Team Lead'} (${resolvedRole === 'marketing_tl' ? 'Marketing TL' : 'Sales TL'}) by ${paName || 'Process Analyst'}. 24-hour SLA officially started.`,
      time: 'Just now',
      type: 'assignment',
    };

    const newThreadMessage = {
      id: `msg-${Date.now()}`,
      name: paName || 'Process Analyst',
      role: 'Process Analyst',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Assigned ticket to ${assignee}. 24-hour SLA countdown starts now.`,
      mine: false,
    };

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          assignee: assignee,
          assigneeRole: resolvedRole,
          targetTeam: resolvedRole === 'marketing_tl' ? 'Marketing' : 'Sales',
          assignedBy: paName || 'Process Analyst',
          assignedAt: now,
          slaDeadline: deadline,
          slaState: 'healthy',
          sla: '24h 00m',
          status: 'In Progress',
        },
        $push: {
          timeline: {
            $each: [newTimelineItem],
            $position: 0,
          },
          thread: newThreadMessage,
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });
    console.log(`[Ticket Assigned] ID: ${updated.id} to ${updated.assignee} (${updated.assigneeRole})`);

    // Emit live WebSocket update so all connected users see it immediately at the top
    try {
      req.app?.get('io')?.emit('ticket_assigned', updated);
      req.app?.get('io')?.emit('tickets_changed');
    } catch (e) {}

    // Send Assigned Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('assigned', updated, {
        assignedTo: updated.assignee,
        processAnalyst: updated.assignedBy || 'Process Analyst',
        team: updated.team,
        slaDeadline: deadline.toLocaleString(),
      })
      .catch((e) => console.error('[Assign Notification Error]:', e.message));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/resolve - Resolve Ticket
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { userName, userRole, notes } = req.body;
    const now = new Date();

    const newTimelineItem = {
      title: 'Ticket Resolved',
      detail: `Resolved by ${userName || 'Team Lead'} (${userRole || ''}). ${notes ? `Notes: ${notes}` : 'Issue addressed.'}`,
      time: 'Just now',
      type: 'resolution',
    };

    const newThreadMessage = {
      id: `msg-${Date.now()}`,
      name: userName || 'Team Lead',
      role: userRole || 'TL',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Marked issue as resolved.${notes ? ` Notes: ${notes}` : ' Solution implemented and verified.'}`,
      mine: false,
    };

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'Resolved',
          slaState: 'met',
          sla: 'Resolved',
          resolvedAt: now,
          ...(notes ? { resolutionNotes: notes } : {}),
        },
        $push: {
          timeline: {
            $each: [newTimelineItem],
            $position: 0,
          },
          thread: newThreadMessage,
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    // Send Resolved Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('resolved', updated, {
        assignedTo: userName || 'Team Lead',
        notes: notes || 'Issue addressed and verified.',
      })
      .catch((e) => console.error('[Resolve Notification Error]:', e.message));

    try { req.app?.get('io')?.emit('tickets_changed'); } catch (e) {}
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/reopen - Reopen Ticket by Sales TL, Marketing TL, or Process Analyst
router.patch('/:id/reopen', async (req, res) => {
  try {
    const { userName, userRole, reason } = req.body;
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newTimelineItem = {
      title: 'Ticket Reopened',
      detail: `Ticket reopened by ${userName || 'Team Lead'} (${userRole || ''}). Reason: ${reason || 'Resolution not satisfactory'}.`,
      time: 'Just now',
      type: 'reopen',
    };

    const newThreadMessage = {
      id: `msg-${Date.now()}`,
      name: userName || 'Team Lead',
      role: userRole || 'TL',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `🔄 Reopened Ticket: ${reason || 'Resolution was not satisfactory. Reopened for further action.'}`,
      mine: false,
    };

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'In Progress',
          slaState: 'healthy',
          sla: '24h 00m',
          slaDeadline: deadline,
          reopenedAt: now,
          reopenedBy: `${userName || 'Team Lead'} (${userRole || ''})`,
          reopenReason: reason || 'Resolution not satisfactory',
        },
        $push: {
          timeline: {
            $each: [newTimelineItem],
            $position: 0,
          },
          thread: newThreadMessage,
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });
    console.log(`[Ticket Reopened] ID: ${updated.id} by ${userName}`);

    // Send Re-Opened Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('reopened', updated, {
        reopenedBy: userName || 'Team Lead',
        reason: reason || 'Resolution not satisfactory.',
      })
      .catch((e) => console.error('[Reopen Notification Error]:', e.message));

    try { req.app?.get('io')?.emit('tickets_changed'); } catch (e) {}
    res.json(updated);
  } catch (error) {
    console.error('Error in reopen:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/escalate - Escalate Ticket
router.patch('/:id/escalate', async (req, res) => {
  try {
    const { userName } = req.body;
    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'Escalated',
          escalatedTo: 'Kavita Rao (Manager)',
          escalatedAt: new Date(),
        },
        $push: {
          timeline: {
            $each: [{
              title: 'Escalated to Executive Governance',
              detail: `Ticket breached SLA limit and was escalated to Manager by ${userName || 'Process Analyst'}.`,
              time: 'Just now',
              type: 'escalation',
            }],
            $position: 0,
          },
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    // Send Escalated Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('escalated', updated, {
        escalatedTo: updated.escalatedTo,
        team: updated.team,
        assignedTo: updated.assignee,
      })
      .catch((e) => console.error('[Escalate Notification Error]:', e.message));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/relax - Relax SLA (Extension)
router.patch('/:id/relax', async (req, res) => {
  try {
    const { userName, reason } = req.body;
    const extendedDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          slaRelaxed: true,
          relaxedBy: userName || 'Process Analyst',
          relaxedAt: new Date(),
          slaDeadline: extendedDeadline,
          slaState: 'healthy',
          slaBreached: false,
          sla: '24h 00m (Relaxed)',
          relaxationReason: reason || '1-day extension granted by Process Analyst',
        },
        $push: {
          timeline: {
            $each: [{
              title: 'SLA Extension Granted',
              detail: `Process Analyst ${userName || ''} granted a 24-hour SLA relaxation. Reason: ${reason || 'Legitimate delay'}.`,
              time: 'Just now',
              type: 'relaxation',
            }],
            $position: 0,
          },
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    // Send Extension Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('extension', updated, {
        requestedBy: userName || 'Process Analyst',
        extensionDays: 1,
        reason: reason || '1-day SLA extension granted by Process Analyst',
        newDeadline: extendedDeadline.toLocaleString(),
      })
      .catch((e) => console.error('[Extension Notification Error]:', e.message));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/tickets/:id/close - Close Ticket
router.patch('/:id/close', async (req, res) => {
  try {
    const { userName, notes } = req.body;
    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'Closed',
          slaState: 'met',
          closedAt: new Date(),
          closedBy: userName || 'Process Analyst',
        },
        $push: {
          timeline: {
            $each: [{
              title: 'Ticket Closed',
              detail: `Ticket confirmed complete and closed by ${userName || 'Process Analyst'}.`,
              time: 'Just now',
              type: 'activity',
            }],
            $position: 0,
          },
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    // Send Closed Notification & Email from Central Support Email
    emailService
      .sendTicketNotification('closed', updated, {
        closedBy: userName || 'Process Analyst',
        notes: notes || 'Confirmed complete and closed.',
      })
      .catch((e) => console.error('[Close Notification Error]:', e.message));

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tickets/:id/messages or PATCH /api/tickets/:id/reply - Add reply message and send real email
const handleReplyMessage = async (req, res) => {
  try {
    const { author, role, text, isPa, authorEmail } = req.body;
    const now = new Date();
    const timeShort = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `msg-${Date.now()}`,
      name: author || 'User',
      role: role || 'User',
      time: timeShort,
      text: text || '',
      mine: false,
      viaEmail: true,
      deliveryStatus: 'sent',
    };

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $push: {
          conversation: {
            author: author || 'User',
            role: role || 'user',
            text: text || '',
            isPa: !!isPa,
            time: 'Just now',
          },
          thread: newMsg,
          timeline: {
            $each: [{
              title: 'Reply Sent',
              detail: `${author || 'User'} sent a message to the continuous thread.`,
              time: 'Just now',
              type: 'activity',
            }],
            $position: 0,
          },
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    // Send real email through Centralized Support Email preserving the thread
    emailService
      .sendTicketReply(updated, text, author || 'User', role || 'User', authorEmail)
      .then(async (sendResult) => {
        const status = sendResult?.deliveryStatus || 'sent';
        await Ticket.updateOne(
          { id: req.params.id, 'thread.id': newMsg.id },
          { $set: { 'thread.$.deliveryStatus': status } }
        );
      })
      .catch((err) => {
        console.error('Error dispatching reply email:', err);
      });

    try { req.app?.get('io')?.emit('tickets_changed'); } catch (e) {}
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

router.patch('/:id/reply', handleReplyMessage);
router.post('/:id/messages', handleReplyMessage);

// DELETE /api/tickets/clear-all - Reset tickets (Clean slate)
router.delete('/clear-all', async (req, res) => {
  try {
    const result = await Ticket.deleteMany({});
    console.log(`[Tickets Cleared] ${result.deletedCount} tickets deleted.`);
    try { req.app?.get('io')?.emit('tickets_changed'); } catch (e) {}
    res.json({ message: 'All tickets cleared successfully', deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tickets/:id - Delete single ticket
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Ticket.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted successfully', ticket: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
