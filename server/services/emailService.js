import 'dotenv/config';
import nodemailer from 'nodemailer';
import { emailTemplates } from './emailTemplates.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Ticket } from '../models/Ticket.js';

class EmailService {
  constructor() {
    this.supportEmail = process.env.SUPPORT_EMAIL || 'support@netbounceplacement.com';
    this.supportName = process.env.SUPPORT_NAME || 'NetBounce Support';
    this.transporter = null;
    this.initTransporter();
  }

  async initTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false },
        });
        console.log(`[EmailService] SMTP Transporter configured for ${host}:${port} (${user})`);
      } catch (err) {
        console.error('[EmailService] Failed to initialize SMTP transporter:', err);
        this.transporter = null;
      }
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.isEthereal = true;
        console.log(`[EmailService] Live Real Email Gateway active! Test account: ${testAccount.user}`);
        console.log(`[EmailService] Every email will now generate a live web preview link!`);
      } catch (e) {
        console.log(`[EmailService] Safe Simulation Mode with audit logging.`);
        this.transporter = null;
      }
    }
  }

  // Reload transporter dynamically if env vars change
  reloadConfig() {
    this.supportEmail = process.env.SUPPORT_EMAIL || 'support@netbounceplacement.com';
    this.supportName = process.env.SUPPORT_NAME || 'NetBounce Support';
    this.initTransporter();
  }

  /**
   * Helper to resolve real email addresses of users by name or role from MongoDB
   */
  async resolveUserEmails(filter = {}) {
    try {
      const users = await User.find(filter);
      return users.map((u) => u.email).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  /**
   * Determine recipients based on ticket workflow event and participants.
   *
   * STRICT RULE (PER USER REQUIREMENT):
   * ─────────────────────────────────────────────────────────────────────────
   *  • Process Analysts → ALWAYS receive every event on every ticket.
   *  • Ticket RAISER    → Always receives updates on their OWN ticket only.
   *  • SPECIFIC Assigned TL → Only the one person assigned (Shivam) gets mail.
   *                           NOT all Marketing TLs — only the assigned one.
   *  • Other TLs of the same role → NEVER receive mail for someone else's ticket.
   *  • Managers → ONLY on Escalated events.
   *  • Candidate → ONLY on Resolved / Closed events.
   * ─────────────────────────────────────────────────────────────────────────
   */
  async determineRecipients(eventType, ticket, extra = {}) {
    const recipients = new Set();

    // ── 1. PROCESS ANALYSTS — always notified on all events ──
    const paEmails = await this.resolveUserEmails({ role: 'process_analyst' });
    paEmails.forEach((em) => recipients.add(em));

    // ── 2. TICKET RAISER — the specific person who created this ticket ──
    // Priority: stored salesPoc email > creatorName DB lookup
    if (ticket.salesPoc && ticket.salesPoc.includes('@')) {
      recipients.add(ticket.salesPoc);
    } else if (ticket.creatorName) {
      // Name-based lookup — matches ONLY the raiser by name, not their whole team
      const creatorEmails = await this.resolveUserEmails({
        name: { $regex: new RegExp(`^${ticket.creatorName.trim()}$`, 'i') },
      });
      creatorEmails.forEach((em) => recipients.add(em));
    }

    // ── 3. SPECIFIC ASSIGNED TL — ONLY the one person assigned to this ticket ──
    // Priority: stored marketingTlEmail > assignee name DB lookup
    // We do NOT look up all users with assigneeRole — only the exact assigned person.
    const assigneeEvents = ['Assigned', 'Reminder', 'Re-Opened', 'Resolved', 'Closed', 'Escalated', 'Extension', 'Breach', 'Reply', 'New'];
    if (assigneeEvents.includes(eventType) || eventType === 'Reply') {
      // If the specific email was stored at ticket-creation time, use it directly
      if (ticket.marketingTlEmail && ticket.marketingTlEmail.includes('@')) {
        recipients.add(ticket.marketingTlEmail);
      }
      // Additionally resolve by the specific assignee NAME (exact match, not role-broad)
      if (ticket.assignee && ticket.assignee !== 'Unassigned') {
        const assigneeEmails = await this.resolveUserEmails({
          name: { $regex: new RegExp(`^${ticket.assignee.trim()}$`, 'i') },
        });
        assigneeEmails.forEach((em) => recipients.add(em));
      }
    }

    // ── 4. REPLY events — notify the correct party (not both) ──
    if (eventType === 'Reply') {
      const senderRole = (extra.senderRole || '').toLowerCase();
      const senderEmail = extra.senderEmail || '';
      // The person who sent the reply should NOT receive their own reply notification
      if (senderEmail) recipients.delete(senderEmail);
    }

    // ── 5. CANDIDATE — only on ticket resolution / closure ──
    if (['Resolved', 'Closed'].includes(eventType)) {
      if (ticket.candidateEmail && ticket.candidateEmail.includes('@')) {
        recipients.add(ticket.candidateEmail);
      }
    }

    // ── 6. MANAGERS — only on escalation ──
    if (eventType === 'Escalated') {
      const mgrEmails = await this.resolveUserEmails({ role: 'manager' });
      mgrEmails.forEach((em) => recipients.add(em));
    }

    // ── 7. Remove the acting user so they don't email themselves ──
    if (extra.currentActorEmail) {
      recipients.delete(extra.currentActorEmail);
    }

    // ── 8. Fallback: if no recipient resolved, send to support inbox ──
    if (recipients.size === 0) {
      recipients.add(this.supportEmail);
    }

    const recipientList = Array.from(recipients).filter(Boolean);
    console.log(`[EmailService] 📧 Strict recipients for "${eventType}" on ticket ${ticket.id || ticket._id}:`, recipientList);
    return recipientList;
  }

  /**
   * Core send email method with email threading headers
   */
  async sendEmail({
    to,
    subject,
    text,
    html,
    ticketId,
    inReplyTo,
    references,
    messageId,
    auditEventType = 'EMAIL_SENT',
    actor = 'System',
    metadata = {},
  }) {
    const toAddress = Array.isArray(to) ? to.join(', ') : to;
    const msgId = messageId || `<ticket-${ticketId}-${Date.now()}@netbounceplacement.com>`;
    const threadRootId = `<ticket-${ticketId}-root@netbounceplacement.com>`;
    const inReplyToHeader = inReplyTo || threadRootId;
    const referencesHeader = references || threadRootId;

    const mailOptions = {
      from: `"${this.supportName}" <${this.supportEmail}>`,
      to: toAddress,
      subject,
      text,
      html,
      messageId: msgId,
      inReplyTo: inReplyToHeader,
      references: referencesHeader,
      headers: {
        'X-Ticket-ID': ticketId,
        'X-NetBounce-Thread': `ticket-${ticketId}`,
      },
    };

    let deliveryStatus = 'sent';
    let errorMessage = null;
    let previewUrl = null;

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        deliveryStatus = 'delivered';
        previewUrl = nodemailer.getTestMessageUrl(info) || null;
        if (previewUrl) {
          console.log(`\n======================================================`);
          console.log(`[EMAIL DISPATCHED TO]: ${toAddress}`);
          console.log(`[SUBJECT]: "${subject}"`);
          console.log(`[📬 CLICK TO VIEW REAL EMAIL IN BROWSER]:`);
          console.log(`>>> ${previewUrl}`);
          console.log(`======================================================\n`);
        } else {
          console.log(`[Email Sent via SMTP] To: ${toAddress} | Subject: "${subject}" | MsgID: ${info.messageId}`);
        }
      } catch (err) {
        console.error(`[Email Failed] To: ${toAddress} | Subject: "${subject}" | Error:`, err.message);
        deliveryStatus = 'failed';
        errorMessage = err.message;
      }
    } else {
      // Safe simulation mode: log clearly
      console.log(`[Email Simulated (Support Email)] From: ${this.supportEmail} -> To: ${toAddress} | Subject: "${subject}" | In-Reply-To: ${inReplyToHeader}`);
      deliveryStatus = 'sent';
    }

    // Create Audit Log in MongoDB
    try {
      const logEntry = new AuditLog({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ticketId,
        eventType: errorMessage ? 'EMAIL_FAILED' : auditEventType,
        actor,
        recipient: toAddress,
        subject,
        messageId: msgId,
        deliveryStatus,
        metadata: {
          ...metadata,
          error: errorMessage,
          inReplyTo: inReplyToHeader,
          previewUrl,
          simulated: !this.transporter,
        },
      });
      await logEntry.save();
    } catch (e) {
      console.error('[EmailService] Failed to create audit log:', e.message);
    }

    return {
      success: deliveryStatus !== 'failed',
      deliveryStatus,
      messageId: msgId,
      to: toAddress,
      subject,
      previewUrl,
      error: errorMessage,
    };
  }

  /**
   * Triggers status change notifications (both Email + Web App Notification)
   */
  async sendTicketNotification(templateType, ticket, extraData = {}) {
    const templateFn = emailTemplates[templateType];
    if (!templateFn) {
      console.warn(`[EmailService] No template found for: ${templateType}`);
      return null;
    }

    const { subject, text, html, webNotice, notificationTitle, notificationDetail, notificationType } = templateFn(
      ticket,
      extraData
    );

    // 1. Determine recipients
    const recipients = await this.determineRecipients(notificationType, ticket, extraData);

    // 2. Dispatch Email through centralized Support email
    const emailResult = await this.sendEmail({
      to: recipients,
      subject,
      text,
      html,
      ticketId: ticket.id,
      inReplyTo: `<ticket-${ticket.id}-root@netbounceplacement.com>`,
      references: `<ticket-${ticket.id}-root@netbounceplacement.com>`,
      auditEventType: `${templateType.toUpperCase()}_EMAIL_SENT`,
      actor: extraData.userName || extraData.assignedBy || extraData.raisedBy || 'System',
      metadata: { templateType, ...extraData },
    });

    // 3. Create Web App Dashboard Notification in MongoDB
    try {
      const notifDoc = new Notification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ticketId: ticket.id,
        recipientEmail: recipients.join(','),
        recipientRole: extraData.targetRole || '',
        type: notificationType,
        title: notificationTitle,
        detail: notificationDetail,
        time: 'Just now',
        unread: true,
        metadata: {
          webNotice,
          emailStatus: emailResult?.deliveryStatus,
          previewUrl: emailResult?.previewUrl,
        },
      });
      await notifDoc.save();
      try {
        global.__io?.emit('notification_new', notifDoc);
      } catch (err) {}
    } catch (e) {
      console.error('[EmailService] Failed to save web notification:', e.message);
    }

    return {
      emailResult,
      webNotice,
    };
  }

  /**
   * Continuous Thread Reply: Send outbound email to other party and store threading headers
   */
  async sendTicketReply(ticket, messageText, senderName, senderRole, senderEmail) {
    const { subject, text, html, notificationTitle, notificationDetail, webNotice } = emailTemplates.chatReply(
      ticket,
      messageText,
      senderName,
      senderRole
    );

    const recipients = await this.determineRecipients('Reply', ticket, {
      senderRole,
      senderEmail,           // used to delete sender from their own reply notification
      currentActorEmail: senderEmail,
    });

    const emailResult = await this.sendEmail({
      to: recipients,
      subject,
      text,
      html,
      ticketId: ticket.id,
      inReplyTo: `<ticket-${ticket.id}-root@netbounceplacement.com>`,
      references: `<ticket-${ticket.id}-root@netbounceplacement.com>`,
      auditEventType: 'TICKET_REPLY_EMAIL_SENT',
      actor: `${senderName} (${senderRole})`,
      metadata: { replyText: messageText },
    });

    // Save Dashboard notification for the other participants
    try {
      const notif = new Notification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ticketId: ticket.id,
        recipientEmail: recipients.join(','),
        type: 'Reply',
        title: notificationTitle,
        detail: notificationDetail,
        time: 'Just now',
        unread: true,
        metadata: {
          previewUrl: emailResult?.previewUrl,
        },
      });
      await notif.save();
      try {
        global.__io?.emit('notification_new', notif);
      } catch (err) {}
    } catch (e) {}

    return emailResult;
  }

  /**
   * Inbound Email Processing:
   * Called when an external email arrives at the Support inbox (via webhook or polling).
   */
  async processIncomingEmail({ from, subject, text, inReplyTo, references, headers = {} }) {
    console.log(`[Inbound Email Received] From: ${from} | Subject: "${subject}"`);

    // 1. Identify Ticket ID: from Subject regex [TKT-XXXX] or #TKT-XXXX or headers
    let ticketId = null;
    const match = (subject || '').match(/\[(TKT-\d+|TIC-\d+)\]/i) || (subject || '').match(/#(TKT-\d+|TIC-\d+)/i);
    if (match) {
      ticketId = match[1].toUpperCase();
    } else if (headers['x-ticket-id']) {
      ticketId = headers['x-ticket-id'];
    }

    if (!ticketId) {
      console.warn('[Inbound Email] No Ticket ID detected in subject or headers.');
      return { success: false, reason: 'Ticket ID not found in subject or headers' };
    }

    const ticket = await Ticket.findOne({ id: ticketId });
    if (!ticket) {
      console.warn(`[Inbound Email] Ticket #${ticketId} does not exist in DB.`);
      return { success: false, reason: `Ticket #${ticketId} not found` };
    }

    // 2. Extract sender name and clean reply text
    const senderEmail = from.includes('<') ? from.match(/<([^>]+)>/)?.[1] : from;
    const senderUser = await User.findOne({ email: new RegExp(senderEmail, 'i') });
    const senderName = senderUser?.name || from.split('<')[0].trim() || 'Team Member';
    const senderRole = senderUser?.roleName || senderUser?.role || 'External Participant';

    // Clean body text (strip quoted email trail if present)
    const cleanBody = (text || '')
      .split(/On\s.+wrote:/)[0]
      .split(/---+\s*Original Message\s*---+/)[0]
      .split(/From:\s/)[0]
      .trim();

    const now = new Date();
    const timeShort = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 3. Check if ticket is Resolved and incoming message indicates dissatisfaction -> Reopen!
    const isReopenIntent =
      ticket.status === 'Resolved' || ticket.status === 'Closed' ||
      /reopen|not resolved|still pending|issue still|not satisfied/i.test(cleanBody);

    const newMsg = {
      id: `msg-${Date.now()}`,
      name: senderName,
      role: senderRole,
      time: timeShort,
      text: cleanBody || text,
      mine: false,
      viaEmail: true,
      inbound: true,
      senderEmail,
    };

    const updateOps = {
      $push: {
        thread: newMsg,
        timeline: {
          $each: [{
            title: 'Email Reply Received',
            detail: `${senderName} replied via email: "${(cleanBody || '').slice(0, 100)}"`,
            time: 'Just now',
            type: 'activity',
          }],
          $position: 0,
        },
      },
    };

    if (isReopenIntent && (ticket.status === 'Resolved' || ticket.status === 'Closed')) {
      const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      updateOps.$set = {
        status: 'In Progress',
        slaState: 'healthy',
        sla: '24h 00m',
        slaDeadline: deadline,
        reopenedAt: now,
        reopenedBy: `${senderName} (via Email)`,
        reopenReason: cleanBody || 'Requester replied with unresolved issue.',
      };
      updateOps.$push.timeline.$each.unshift({
        title: 'Ticket Reopened',
        detail: `Ticket reopened via email response from ${senderName}. Reason: ${cleanBody || 'Unsatisfied with resolution.'}`,
        time: 'Just now',
        type: 'reopen',
      });
    }

    const updated = await Ticket.findOneAndUpdate({ id: ticketId }, updateOps, { new: true });

    // 4. Create Audit Log
    try {
      const log = new AuditLog({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        eventType: isReopenIntent ? 'REOPEN_VIA_INBOUND_EMAIL' : 'INBOUND_EMAIL_RECEIVED',
        actor: senderName,
        recipient: this.supportEmail,
        subject,
        deliveryStatus: 'delivered',
        metadata: { senderEmail, cleanBody, isReopenIntent },
      });
      await log.save();
    } catch (e) {}

    // 5. Create Web Notification
    try {
      const notif = new Notification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        type: isReopenIntent ? 'Re-Opened' : 'Reply',
        title: isReopenIntent ? `Ticket #${ticketId} Re-Opened` : `New Email Reply on #${ticketId}`,
        detail: `${senderName}: "${(cleanBody || '').slice(0, 80)}"`,
        time: 'Just now',
        unread: true,
      });
      await notif.save();
    } catch (e) {}

    return {
      success: true,
      ticketId,
      messageAdded: newMsg,
      reopened: isReopenIntent,
      ticket: updated,
    };
  }
}

export const emailService = new EmailService();
