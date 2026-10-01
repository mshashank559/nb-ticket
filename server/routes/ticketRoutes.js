import express from 'express';
import mongoose from 'mongoose';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { emailService } from '../services/emailService.js';

const router = express.Router();

// Helper to check if requester is authorized to view a ticket
const isUserAuthorizedForTicket = (ticket, userCtx, allUsers = []) => {
  if (!ticket || !userCtx) return true;
  const role = userCtx.role || '';
  const name = (userCtx.name || '').trim().toLowerCase();
  const email = (userCtx.email || '').trim().toLowerCase();

  if (!role && !name && !email) return true;
  if (role === 'process_analyst' || role === 'admin') return true;

  const userDoc = allUsers.find((u) =>
    (name && u.name?.trim().toLowerCase() === name) ||
    (email && u.email?.trim().toLowerCase() === email)
  );

  const effectiveRole = role || userDoc?.role || '';
  const effectiveEmail = email || userDoc?.email?.toLowerCase() || '';

  const tCreator = (ticket.createdBy || ticket.creatorName || '').trim().toLowerCase();
  const tAssignee = (ticket.assignee || '').trim().toLowerCase();
  const tRecruiter = (ticket.recruiter || '').trim().toLowerCase();
  const tSalesRep = (ticket.salesRep || '').trim().toLowerCase();
  const tSalesPoc = (ticket.salesPoc || '').trim().toLowerCase();
  const tMktEmail = (ticket.marketingTlEmail || '').trim().toLowerCase();

  const isDirectParticipant =
    (name && (
      tCreator === name ||
      tAssignee === name ||
      tRecruiter === name ||
      tSalesRep === name ||
      tSalesPoc === name
    )) ||
    (effectiveEmail && (
      tSalesPoc === effectiveEmail ||
      tMktEmail === effectiveEmail ||
      tAssignee === effectiveEmail
    ));

  if (effectiveRole === 'sales_tl' || effectiveRole === 'marketing_tl') {
    return isDirectParticipant;
  }

  if (effectiveRole === 'manager') {
    const escalatedTo = (ticket.escalatedTo || '').toLowerCase();
    if (escalatedTo && name && escalatedTo.includes(name)) return true;
    if (isDirectParticipant) return true;

    // Reporting hierarchy check: does the creator or assignee report to this manager?
    const reportees = allUsers.filter((u) => {
      const mName = (u.manager || '').toLowerCase();
      const mEmail = (u.managerEmail || '').toLowerCase();
      return (
        (name && mName === name) ||
        (effectiveEmail && mEmail === effectiveEmail) ||
        (userDoc?.id && u.managerId === userDoc.id)
      );
    });

    if (reportees.length > 0) {
      const reporteeNames = new Set(reportees.map((u) => (u.name || '').toLowerCase()).filter(Boolean));
      const reporteeEmails = new Set(reportees.map((u) => (u.email || '').toLowerCase()).filter(Boolean));
      return (
        reporteeNames.has(tCreator) ||
        reporteeNames.has(tAssignee) ||
        reporteeNames.has(tRecruiter) ||
        reporteeNames.has(tSalesRep) ||
        reporteeEmails.has(tSalesPoc) ||
        reporteeEmails.has(tMktEmail)
      );
    }

    const userDept = (userDoc?.department || '').toLowerCase();
    const ticketTeam = (ticket.team || ticket.targetTeam || '').toLowerCase();
    if (userDept && ticketTeam && userDept.includes(ticketTeam)) return true;
    return true;
  }

  return true;
};

// Helper to format remaining time or deadline
const calcSLARemaining = (deadline) => {
  if (!deadline) return 'Not Started';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Breached';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
};

// GET /api/tickets - List all tickets (filtered by authorization if user context present)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const tickets = await Ticket.find().sort({ updatedAt: -1, createdAt: -1 });

    const reqUser = {
      name: req.headers['x-user-name'] || req.query.userName || '',
      role: req.headers['x-user-role'] || req.query.userRole || '',
      email: req.headers['x-user-email'] || req.query.userEmail || '',
    };

    let allUsers = [];
    if (reqUser.role || reqUser.name || reqUser.email) {
      allUsers = await User.find();
    }

    // Recalculate dynamic SLA string & status
    const mapped = tickets.map((t) => {
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

    if (reqUser.role || reqUser.name || reqUser.email) {
      const authorized = mapped.filter((t) => isUserAuthorizedForTicket(t, reqUser, allUsers));
      return res.json(authorized);
    }

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

    const reqUser = {
      name: req.headers['x-user-name'] || req.query.userName || '',
      role: req.headers['x-user-role'] || req.query.userRole || '',
      email: req.headers['x-user-email'] || req.query.userEmail || '',
    };

    if (reqUser.role || reqUser.name || reqUser.email) {
      const allUsers = await User.find();
      if (!isUserAuthorizedForTicket(ticket, reqUser, allUsers)) {
        return res.status(403).json({ error: 'Forbidden: You are not authorized to view this ticket.' });
      }
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
    const existing = nextId ? await Ticket.findOne({ id: nextId }) : null;
    if (!nextId || existing) {
      const count = await Ticket.countDocuments();
      const lastTicket = await Ticket.findOne({ id: /^(TKT|TIC)-/ }).sort({ createdAt: -1 });
      let nextNum = 1001 + count;
      if (lastTicket && lastTicket.id) {
        const num = parseInt(lastTicket.id.replace(/^(TKT|TIC)-/, ''), 10);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
      nextId = `TKT-${nextNum}`;
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
    let targetAssigneeId = req.body.assigneeId || '';
    let targetAssigneeEmail = req.body.assigneeEmail || '';

    let targetSalesTlId = req.body.targetSalesTlId || req.body.selectedSalesTlId || '';
    let targetSalesTlName = req.body.targetSalesTlName || '';
    let targetSalesTlEmail = req.body.targetSalesTlEmail || '';

    // If Sales TL selection was provided (from Marketing TL or direct assignment):
    if (targetSalesTlId) {
      const stlUser = await User.findOne({
        id: targetSalesTlId,
        role: { $in: ['sales_tl', 'SALES_TL'] },
        status: { $regex: /^active$/i },
      });
      if (!stlUser) {
        return res.status(400).json({
          error: 'Invalid Sales TL assignment. Selected user does not exist, is not active, or does not have Sales TL role.'
        });
      }
      targetSalesTlId = stlUser.id;
      targetSalesTlName = stlUser.name;
      targetSalesTlEmail = stlUser.email;

      // In the Marketing -> Sales workflow, if assigned directly or intended as assignee:
      if (targetAssignee === 'Unassigned' || targetAssignee === stlUser.name) {
        targetAssignee = stlUser.name;
        targetAssigneeId = stlUser.id;
        targetAssigneeEmail = stlUser.email;
        targetAssigneeRole = 'sales_tl';
      }
    }

    if (targetAssignee && targetAssignee !== 'Unassigned' && !targetAssigneeRole) {
      try {
        const u = await User.findOne({ name: targetAssignee });
        if (u) {
          targetAssigneeRole = u.role;
          if (!targetAssigneeId) targetAssigneeId = u.id;
          if (!targetAssigneeEmail) targetAssigneeEmail = u.email;
        }
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
      assigneeId: targetAssigneeId,
      assigneeEmail: targetAssigneeEmail,
      assigneeRole: targetAssigneeRole,
      targetSalesTlId,
      targetSalesTlName,
      targetSalesTlEmail,
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
    const { assignee, paName, assigneeRole: explicitRole, assigneeId } = req.body;
    let resolvedRole = explicitRole;
    let resolvedId = assigneeId || '';
    let resolvedName = assignee;
    let resolvedEmail = '';

    // Strictly validate against User Management database
    let validatedUser = null;
    if (resolvedId) {
      validatedUser = await User.findOne({
        id: resolvedId,
        status: { $regex: /^active$/i },
      });
    } else if (assignee) {
      validatedUser = await User.findOne({
        name: { $regex: new RegExp(`^${assignee.trim()}$`, 'i') },
        status: { $regex: /^active$/i },
      });
    }

    if (validatedUser) {
      resolvedId = validatedUser.id;
      resolvedName = validatedUser.name;
      resolvedEmail = validatedUser.email;
      resolvedRole = validatedUser.role;
    } else if (!resolvedRole && assignee) {
      resolvedRole = 'sales_tl';
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newTimelineItem = {
      title: 'Assigned to Team Lead',
      detail: `Assigned to ${resolvedName || 'Team Lead'} (${resolvedRole === 'marketing_tl' ? 'Marketing TL' : 'Sales TL'}) by ${paName || 'Process Analyst'}. 24-hour SLA officially started.`,
      time: 'Just now',
      type: 'assignment',
    };

    const newThreadMessage = {
      id: `msg-${Date.now()}`,
      name: paName || 'Process Analyst',
      role: 'Process Analyst',
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Assigned ticket to ${resolvedName}. 24-hour SLA countdown starts now.`,
      mine: false,
    };

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          assignee: resolvedName,
          assigneeId: resolvedId,
          assigneeEmail: resolvedEmail,
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
    console.log(`[Ticket Assigned] ID: ${updated.id} to ${updated.assignee} (${updated.assigneeRole}) [UserId: ${updated.assigneeId}]`);

    // Audit Log Creation
    try {
      const auditEntry = new AuditLog({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ticketId: updated.id,
        eventType: 'TICKET_ASSIGNED',
        actor: paName || 'Process Analyst',
        recipient: resolvedEmail || updated.assignee,
        subject: `Ticket ${updated.id} assigned to ${resolvedName} (${resolvedRole === 'marketing_tl' ? 'Marketing TL' : 'Sales TL'}) by ${paName || 'Process Analyst'}.`,
        deliveryStatus: 'sent',
        metadata: {
          ticketId: updated.id,
          assigneeUserId: resolvedId,
          assigneeName: resolvedName,
          assigneeRole: resolvedRole,
          actorUserId: req.body.actorUserId || paName || 'Process Analyst',
          actorRole: req.body.actorRole || 'process_analyst',
          timestamp: now.toISOString(),
        },
      });
      await auditEntry.save();
    } catch (auditErr) {
      console.error('[Ticket Assign Audit Log Error]:', auditErr.message);
    }

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

// PATCH /api/tickets/:id/reopen - Reopen Ticket by Sales TL, Marketing TL, or Process Analyst (7-day window enforced)
router.patch('/:id/reopen', async (req, res) => {
  try {
    const { userName, userRole, reason } = req.body;

    const existingTicket = await Ticket.findOne({ id: req.params.id });
    if (!existingTicket) return res.status(404).json({ error: 'Ticket not found' });

    // 7-DAY REOPEN WINDOW CHECK
    if (existingTicket.status === 'Closed') {
      const closedTime = existingTicket.closedAt ? new Date(existingTicket.closedAt).getTime() : 0;
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (closedTime && Date.now() - closedTime > SEVEN_DAYS_MS) {
        // Write audit log entry
        try {
          const audit = new AuditLog({
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            ticketId: existingTicket.id,
            eventType: 'REOPEN_REJECTED',
            actor: userName || 'User',
            recipient: userName || 'User',
            subject: `Reopen attempt rejected for #${existingTicket.id}`,
            metadata: {
              reason: 'Reopen attempt rejected — 7-day reopen window expired.',
              closedAt: existingTicket.closedAt,
              attemptedAt: new Date(),
            },
          });
          await audit.save();
        } catch (e) {
          console.error('[AuditLog Error]:', e.message);
        }

        return res.status(403).json({
          error: 'Reopen window expired. Tickets can only be reopened within 7 days of closure.',
          code: 'REOPEN_WINDOW_EXPIRED',
        });
      }
    }

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

// PATCH /api/tickets/:id/escalate - Escalate Ticket to Assignee's specific manager
router.patch('/:id/escalate', async (req, res) => {
  try {
    const { userName } = req.body;
    const existingTicket = await Ticket.findOne({ id: req.params.id });
    if (!existingTicket) return res.status(404).json({ error: 'Ticket not found' });

    // Dynamically resolve Assignee's specific manager from User Management
    let targetManager = 'Manager';
    let targetManagerEmail = null;

    if (existingTicket.assignee && existingTicket.assignee !== 'Unassigned') {
      const assigneeUser = await User.findOne({
        name: { $regex: new RegExp(`^${existingTicket.assignee.trim()}$`, 'i') },
      });
      if (assigneeUser) {
        if (assigneeUser.manager) targetManager = assigneeUser.manager;
        if (assigneeUser.managerEmail) targetManagerEmail = assigneeUser.managerEmail;
      }
    }

    if (!targetManagerEmail) {
      const mgrUser = await User.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${targetManager.trim()}$`, 'i') } },
          { role: 'manager' },
        ],
      });
      if (mgrUser) {
        targetManager = mgrUser.name;
        targetManagerEmail = mgrUser.email;
      }
    }

    const updated = await Ticket.findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'Escalated',
          escalatedTo: `${targetManager} (Manager)`,
          escalatedAt: new Date(),
        },
        $push: {
          timeline: {
            $each: [{
              title: 'Escalated to Executive Governance',
              detail: `Ticket breached SLA limit and was escalated to ${targetManager} (Manager) by ${userName || 'Process Analyst'}.`,
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

    // Send Escalated Notification & Email strictly to Assignee's Manager + PA + Creator
    emailService
      .sendTicketNotification('escalated', updated, {
        escalatedTo: `${targetManager} (Manager)`,
        managerEmail: targetManagerEmail,
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
