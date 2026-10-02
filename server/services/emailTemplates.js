/**
 * Official Ticket Status Notification Templates
 * Derived directly from the NetBounce Ticketing Specification Document.
 * Both Email and Web App notifications are generated from this unified source.
 */

/**
 * Resolves the application base URL from environment configuration.
 * Prioritizes APP_BASE_URL (per requirement), then APP_URL.
 * In production or when deployed, strictly ensures production domain is used and never localhost.
 */
export function getAppBaseUrl() {
  const envUrl = process.env.APP_BASE_URL || process.env.APP_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://support.netbounceplacement.com';
  }
  return 'http://localhost:5173';
}

/**
 * Centralized Ticket Deep-Link URL Builder.
 * Ensures ALL ticket emails generate the canonical deep-link to the exact Ticket Detail / Chat screen:
 * APP_BASE_URL/tickets/:ticketId?ref=email
 *
 * @param {string} ticketId - e.g. "TKT-1024"
 * @param {string} [source='email'] - tracking parameter for audit analytics
 * @returns {string} Fully-qualified production URL
 */
export function buildTicketUrl(ticketId, source = 'email') {
  const baseUrl = getAppBaseUrl();
  if (!ticketId) return baseUrl;
  const cleanId = String(ticketId).replace(/^#/, '').trim();
  const query = source ? `?ref=${encodeURIComponent(source)}` : '';
  return `${baseUrl}/tickets/${cleanId}${query}`;
}

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@netbounceplacement.com';
const COMPANY_NAME = 'NetBounce Support';

// Base HTML wrapper with NetBounce branding
function wrapHtml(title, preheader, bodyContent, actionUrl, actionText = 'Open Ticket') {
  const appBaseUrl = getAppBaseUrl();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #131b2e; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 30px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; }
    .brand { font-size: 18px; font-weight: 700; color: #60a5fa; letter-spacing: -0.5px; text-decoration: none; }
    .brand span { color: #f1f5f9; }
    .badge { background: rgba(96, 165, 250, 0.15); color: #93c5fd; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(96, 165, 250, 0.3); }
    .content { padding: 32px 30px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 16px; color: #ffffff; }
    p { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px; }
    .meta-box { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 18px 20px; margin: 20px 0; }
    .meta-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); font-size: 13px; }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: #94a3b8; font-weight: 500; }
    .meta-value { color: #f8fafc; font-weight: 600; text-align: right; }
    .btn-container { text-align: center; margin: 30px 0 10px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
    .footer { padding: 20px 30px; background: rgba(15, 23, 42, 0.8); border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer a { color: #60a5fa; text-decoration: none; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  <div class="container">
    <div class="header">
      <a href="${appBaseUrl}" class="brand">NET<span>BOUNCE</span> SUPPORT</a>
      <span class="badge">Official Support Notice</span>
    </div>
    <div class="content">
      ${bodyContent}
      ${actionUrl ? `
      <div class="btn-container">
        <a href="${actionUrl}" class="btn">${actionText} &rarr;</a>
      </div>` : ''}
    </div>
    <div class="footer">
      This is an automated notification from ${COMPANY_NAME} &lt;${SUPPORT_EMAIL}&gt;.<br>
      Replying directly to this email will attach your message to the continuous ticket conversation.
    </div>
  </div>
</body>
</html>
`;
}

export const emailTemplates = {
  // 1. Created
  created: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || 'Untitled Ticket';
    const raisedBy = ticket.createdBy || ticket.creatorName || extra.raisedBy || 'Team Member';
    const originatingTeam = ticket.team || extra.originatingTeam || 'Originating Team';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `New Ticket Raised – #${ticketId}: ${ticketTitle}`;
    const text = `Dear Process Analyst Team,\n\nA new ticket has been created by ${originatingTeam} and is pending your review and assignment.\n\n* Ticket ID: ${ticketId}\n* Title: ${ticketTitle}\n* Raised By: ${raisedBy}\n* Originating Team: ${originatingTeam}\n* Status: Created\n\nPlease review and assign this ticket to the respective person/team shortly.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>New Ticket Pending Assignment</h1>
      <p>Dear Process Analyst Team, a new ticket has been created by <strong>${originatingTeam}</strong> and is pending your review and assignment.</p>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Title:</span><span class="meta-value">${ticketTitle}</span></div>
        <div class="meta-row"><span class="meta-label">Raised By:</span><span class="meta-value">${raisedBy}</span></div>
        <div class="meta-row"><span class="meta-label">Originating Team:</span><span class="meta-value">${originatingTeam}</span></div>
        <div class="meta-row"><span class="meta-label">Priority:</span><span class="meta-value">${ticket.priority || 'Medium'}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value" style="color: #60a5fa;">Created (Unassigned)</span></div>
      </div>
      <p>Please review and assign this ticket to the respective person/team shortly.</p>
    `;

    const webNotice = `🆕 New ticket #${ticketId} created by ${raisedBy} (${originatingTeam}): "${ticketTitle}"`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `New ticket #${ticketId} created`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `New Ticket Created`,
      notificationDetail: `Ticket #${ticketId} created by ${raisedBy} (${originatingTeam}). Assignment required.`,
      notificationType: 'Created',
    };
  },

  // 2. Open
  open: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const slaDeadline = extra.slaDeadline || ticket.slaDeadline || '24 hours';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Ticket #${ticketId} is now Open`;
    const text = `Dear Team,\n\nTicket #${ticketId} ("${ticketTitle}") has been reviewed and marked Open. It is now active and pending action.\n\n* SLA Deadline: ${slaDeadline}\n\nPlease take note and proceed accordingly.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>Ticket is Now Open</h1>
      <p>Dear Team, Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") has been reviewed and marked Open. It is now active and pending action.</p>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value" style="color: #10b981;">Open / Active</span></div>
        <div class="meta-row"><span class="meta-label">SLA Deadline:</span><span class="meta-value">${slaDeadline}</span></div>
      </div>
      <p>Please take note and proceed accordingly.</p>
    `;

    const webNotice = `📂 Ticket #${ticketId} is now Open and pending action.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Ticket #${ticketId} is now Open`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Open`,
      notificationDetail: `Ticket #${ticketId} is now Open and active.`,
      notificationType: 'Open',
    };
  },

  // 3. Assigned
  assigned: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const assignedTo = ticket.assignee || extra.assignedTo || 'Team Lead';
    const processAnalyst = ticket.assignedBy || extra.processAnalyst || 'Process Analyst';
    const raisedBy = ticket.createdBy || ticket.creatorName || extra.raisedBy || 'Originating Lead';
    const team = ticket.team || extra.team || 'Department';
    const slaDeadline = extra.slaDeadline || ticket.slaDeadline || '24 hours from assignment';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Ticket #${ticketId} Assigned to ${assignedTo}`;
    const text = `Dear ${assignedTo},\n\nProcess Analyst ${processAnalyst} has reviewed Ticket #${ticketId} ("${ticketTitle}") and assigned it to you / your team (${team}).\n\n* Raised By: ${raisedBy}\n* Assigned By: ${processAnalyst}\n* SLA Deadline: ${slaDeadline}\n\nPlease take necessary action within the SLA window.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>Ticket Assigned to You</h1>
      <p>Dear <strong>${assignedTo}</strong>, Process Analyst <strong>${processAnalyst}</strong> has reviewed Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") and assigned it to you / your team (<strong>${team}</strong>).</p>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Raised By:</span><span class="meta-value">${raisedBy}</span></div>
        <div class="meta-row"><span class="meta-label">Assigned By:</span><span class="meta-value">${processAnalyst}</span></div>
        <div class="meta-row"><span class="meta-label">SLA Window:</span><span class="meta-value" style="color: #f59e0b;">24-Hour Countdown Started</span></div>
        <div class="meta-row"><span class="meta-label">SLA Deadline:</span><span class="meta-value">${slaDeadline}</span></div>
      </div>
      <p>Please take necessary action within the SLA window.</p>
    `;

    const webNotice = `👤 Ticket #${ticketId} assigned to ${assignedTo} (${team}) by ${processAnalyst}.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Ticket #${ticketId} assigned to ${assignedTo}`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Assigned`,
      notificationDetail: `Ticket #${ticketId} assigned to ${assignedTo} (${team}) by ${processAnalyst}. 24-hr SLA active.`,
      notificationType: 'Assigned',
    };
  },

  // 4. Resolved
  resolved: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const raisedBy = ticket.createdBy || ticket.creatorName || extra.raisedBy || 'Ticket Creator';
    const assignedTo = ticket.assignee || extra.assignedTo || 'Team Lead';
    const resolutionSummary = extra.notes || ticket.resolutionNotes || 'Issue addressed and solution verified.';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Ticket #${ticketId} Resolved`;
    const text = `Dear ${raisedBy},\n\nYour ticket #${ticketId} ("${ticketTitle}") has been marked as Resolved.\n\n* Resolution Summary: ${resolutionSummary}\n* Resolved By: ${assignedTo}\n\nIf you are satisfied, no further action is needed and the ticket will be auto-closed. If not, you may reopen it.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>Ticket Marked as Resolved</h1>
      <p>Dear <strong>${raisedBy}</strong>, your ticket <strong>#${ticketId}</strong> ("${ticketTitle}") has been marked as Resolved.</p>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Resolved By:</span><span class="meta-value">${assignedTo}</span></div>
        <div class="meta-row"><span class="meta-label">Resolution Summary:</span><span class="meta-value">${resolutionSummary}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value" style="color: #10b981;">Resolved</span></div>
      </div>
      <p>If you are satisfied, no further action is needed and the ticket will be auto-closed. If not, you may reopen it directly from the ticket page or by replying to this email.</p>
    `;

    const webNotice = `✅ Ticket #${ticketId} marked Resolved by ${assignedTo}.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Ticket #${ticketId} resolved by ${assignedTo}`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Resolved`,
      notificationDetail: `Ticket #${ticketId} marked Resolved by ${assignedTo}.`,
      notificationType: 'Resolved',
    };
  },

  // 5. Reminder – Before Escalation
  reminder: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const assignedTo = ticket.assignee || extra.assignedTo || 'Team Lead';
    const slaDeadline = extra.slaDeadline || ticket.slaDeadline || 'Approaching Deadline';
    const timeRemaining = extra.timeRemaining || ticket.sla || '4 hours';
    const currentStatus = ticket.status || 'In Progress';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `⏰ Reminder: Ticket #${ticketId} nearing SLA deadline`;
    const text = `Dear ${assignedTo},\n\nThis is a reminder that Ticket #${ticketId} ("${ticketTitle}") is approaching its SLA deadline and will be automatically escalated if not actioned in time.\n\n* SLA Deadline: ${slaDeadline}\n* Time Remaining: ${timeRemaining}\n* Current Status: ${currentStatus}\n\nPlease take action now to avoid escalation.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1 style="color: #f59e0b;">⏰ SLA Deadline Approaching</h1>
      <p>Dear <strong>${assignedTo}</strong>, this is a reminder that Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") is approaching its SLA deadline and will be automatically escalated if not actioned in time.</p>
      <div class="meta-box" style="border-left: 4px solid #f59e0b;">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Time Remaining:</span><span class="meta-value" style="color: #f59e0b;">${timeRemaining}</span></div>
        <div class="meta-row"><span class="meta-label">SLA Deadline:</span><span class="meta-value">${slaDeadline}</span></div>
        <div class="meta-row"><span class="meta-label">Current Status:</span><span class="meta-value">${currentStatus}</span></div>
      </div>
      <p>Please take action now to avoid escalation to governance.</p>
    `;

    const webNotice = `⏰ Reminder: Ticket #${ticketId} is nearing its SLA deadline (${timeRemaining} left). Act now to avoid escalation.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Reminder: Ticket #${ticketId} nearing deadline`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `SLA Reminder`,
      notificationDetail: `Ticket #${ticketId} is nearing SLA deadline (${timeRemaining} remaining).`,
      notificationType: 'Reminder',
    };
  },

  // 6. Escalated
  escalated: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const escalatedTo = ticket.escalatedTo || extra.escalatedTo || 'Manager';
    const team = ticket.team || extra.team || 'Department';
    const creator = ticket.createdBy || ticket.creatorName || extra.raisedBy || 'Ticket Creator';
    const assignedTo = ticket.assignee || extra.assignedTo || 'Unassigned';
    const slaDeadline = extra.slaDeadline || ticket.slaDeadline || '24 hours';
    const breachTime = ticket.breachedAt || extra.breachTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `[${ticketId}] Escalated — SLA Breach`;
    const text = `Dear ${escalatedTo},\n\nTicket #${ticketId} ("${ticketTitle}") has breached its 24-hour turnaround SLA and has been escalated to you for managerial intervention.\n\n* Ticket ID: #${ticketId}\n* Creator: ${creator}\n* Assignee: ${assignedTo}\n* Manager: ${escalatedTo}\n* SLA Deadline: ${slaDeadline}\n* Breach Time: ${breachTime}\n\nKindly review and action on priority.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1 style="color: #ef4444;">⚠ Ticket Escalated — SLA Breach</h1>
      <p>Dear <strong>${escalatedTo}</strong>, Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") has breached its 24-hour turnaround SLA and has been escalated to you for managerial intervention.</p>
      <div class="meta-box" style="border-left: 4px solid #ef4444;">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Creator:</span><span class="meta-value">${creator}</span></div>
        <div class="meta-row"><span class="meta-label">Assignee:</span><span class="meta-value">${assignedTo}</span></div>
        <div class="meta-row"><span class="meta-label">Manager:</span><span class="meta-value">${escalatedTo}</span></div>
        <div class="meta-row"><span class="meta-label">Originating Team:</span><span class="meta-value">${team}</span></div>
        <div class="meta-row"><span class="meta-label">SLA Deadline:</span><span class="meta-value">${slaDeadline}</span></div>
        <div class="meta-row"><span class="meta-label">Breach Time:</span><span class="meta-value" style="color: #ef4444;">${breachTime}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value" style="color: #ef4444;">Escalated / Breached</span></div>
      </div>
      <p>Kindly review and take necessary action.</p>
    `;

    const webNotice = `🚨 [${ticketId}] Escalated — SLA Breach. Escalated to ${escalatedTo}.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `[${ticketId}] Escalated to ${escalatedTo}`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Escalated`,
      notificationDetail: `[${ticketId}] Escalated to ${escalatedTo} — SLA breached.`,
      notificationType: 'Escalated',
    };
  },

  // 7. Closed
  closed: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const raisedBy = ticket.createdBy || ticket.creatorName || extra.raisedBy || 'Ticket Creator';
    const closedBy = extra.closedBy || 'Process Analyst / System';
    const resolutionSummary = extra.notes || ticket.resolutionNotes || 'Confirmed complete and archived.';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Ticket #${ticketId} Closed`;
    const text = `Dear ${raisedBy},\n\nTicket #${ticketId} ("${ticketTitle}") has been confirmed complete and is now Closed.\n\n* Closed By: ${closedBy}\n* Resolution Summary: ${resolutionSummary}\n\nThank you for your patience.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>Ticket Confirmed Closed</h1>
      <p>Dear <strong>${raisedBy}</strong>, Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") has been confirmed complete and is now Closed.</p>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Closed By:</span><span class="meta-value">${closedBy}</span></div>
        <div class="meta-row"><span class="meta-label">Resolution Summary:</span><span class="meta-value">${resolutionSummary}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value">Closed</span></div>
      </div>
      <p>Thank you for your patience.</p>
    `;

    const webNotice = `🔒 Ticket #${ticketId} has been Closed.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Ticket #${ticketId} closed`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Closed`,
      notificationDetail: `Ticket #${ticketId} has been closed by ${closedBy}.`,
      notificationType: 'Closed',
    };
  },

  // 8. Re-Opened
  reopened: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const assignedTo = ticket.assignee || extra.assignedTo || 'Team Lead';
    const reopenedBy = extra.reopenedBy || ticket.reopenedBy || 'Requester';
    const reason = extra.reason || ticket.reopenReason || 'Resolution was not satisfactory.';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Ticket #${ticketId} Re-Opened`;
    const text = `Dear ${assignedTo},\n\nTicket #${ticketId} ("${ticketTitle}") has been Re-Opened by ${reopenedBy} as the previous resolution was not satisfactory.\n\n* Reason: ${reason}\n\nPlease review and take further action.\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1 style="color: #f59e0b;">🔁 Ticket Re-Opened</h1>
      <p>Dear <strong>${assignedTo}</strong>, Ticket <strong>#${ticketId}</strong> ("${ticketTitle}") has been Re-Opened by <strong>${reopenedBy}</strong> as the previous resolution was not satisfactory.</p>
      <div class="meta-box" style="border-left: 4px solid #f59e0b;">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Re-Opened By:</span><span class="meta-value">${reopenedBy}</span></div>
        <div class="meta-row"><span class="meta-label">Mandatory Reason:</span><span class="meta-value" style="color: #f59e0b;">${reason}</span></div>
        <div class="meta-row"><span class="meta-label">Status:</span><span class="meta-value" style="color: #f59e0b;">In Progress (Reopened)</span></div>
        <div class="meta-row"><span class="meta-label">SLA Window:</span><span class="meta-value">Fresh 24h Countdown Active</span></div>
      </div>
      <p>Please review the ticket conversation and take further action.</p>
    `;

    const webNotice = `🔁 Ticket #${ticketId} Re-Opened by ${reopenedBy}.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Ticket #${ticketId} reopened by ${reopenedBy}`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `Ticket Reopened`,
      notificationDetail: `Ticket #${ticketId} reopened by ${reopenedBy}. Reason: ${reason}`,
      notificationType: 'Re-Opened',
    };
  },

  // 9. Extension
  extension: (ticket, extra = {}) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const assignedTo = extra.requestedBy || ticket.assignee || extra.userName || 'Assigned Lead';
    const extensionDays = extra.extensionDays || 1;
    const reason = extra.reason || extra.relaxationReason || ticket.relaxationReason || 'Additional investigation required.';
    const slaDeadline = extra.newDeadline || ticket.slaDeadline || 'Extended by 24h';
    const actionUrl = buildTicketUrl(ticketId);

    const subject = `Extension Requested for Ticket #${ticketId}`;
    const text = `Dear Team,\n\nAn extension of ${extensionDays} day(s) has been requested for Ticket #${ticketId} ("${ticketTitle}").\n\n* Requested By: ${assignedTo}\n* Reason: ${reason}\n* New SLA Deadline: ${slaDeadline}\n\nOpen Ticket: ${actionUrl}`;

    const bodyContent = `
      <h1>⏳ SLA Extension Granted</h1>
      <p>Dear Team, an extension of <strong>${extensionDays} day(s)</strong> has been granted for Ticket <strong>#${ticketId}</strong> ("${ticketTitle}").</p>
      <div class="meta-box" style="border-left: 4px solid #10b981;">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Requested / Approved By:</span><span class="meta-value">${assignedTo}</span></div>
        <div class="meta-row"><span class="meta-label">Extension Period:</span><span class="meta-value">${extensionDays} Day(s)</span></div>
        <div class="meta-row"><span class="meta-label">Reason:</span><span class="meta-value">${reason}</span></div>
        <div class="meta-row"><span class="meta-label">New SLA Deadline:</span><span class="meta-value" style="color: #10b981;">${slaDeadline}</span></div>
      </div>
      <p>The original SLA has been adjusted. Please proceed with resolution.</p>
    `;

    const webNotice = `⏳ Extension of ${extensionDays} day(s) requested for Ticket #${ticketId}.`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `Extension requested for Ticket #${ticketId}`, bodyContent, actionUrl),
      webNotice,
      notificationTitle: `SLA Extension`,
      notificationDetail: `Extension of ${extensionDays} day(s) granted for Ticket #${ticketId}.`,
      notificationType: 'Extension',
    };
  },

  // Continuous Chat Thread Reply
  chatReply: (ticket, message, senderName, senderRole) => {
    const ticketId = ticket.id;
    const ticketTitle = ticket.title || '';
    const subject = `Re: [${ticketId}] ${ticketTitle}`;
    const actionUrl = buildTicketUrl(ticketId);

    const bodyContent = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 6px;">New reply from <strong>${senderName}</strong> (${senderRole}):</div>
        <div style="background: rgba(30, 41, 59, 0.7); border-left: 3px solid #3b82f6; padding: 16px; border-radius: 6px; font-size: 15px; color: #f8fafc; white-space: pre-wrap;">${message.text || message}</div>
      </div>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Ticket ID:</span><span class="meta-value">#${ticketId}</span></div>
        <div class="meta-row"><span class="meta-label">Current Status:</span><span class="meta-value">${ticket.status || 'In Progress'}</span></div>
      </div>
    `;

    const text = `${senderName} (${senderRole}) replied to Ticket #${ticketId}:\n\n"${message.text || message}"\n\nOpen Ticket: ${actionUrl}`;

    return {
      subject,
      text,
      html: wrapHtml(subject, `${senderName} replied to #${ticketId}`, bodyContent, actionUrl, 'View in Continuous Thread'),
      webNotice: `💬 ${senderName}: "${(message.text || message || '').slice(0, 60)}..." on #${ticketId}`,
      notificationTitle: `New Reply on #${ticketId}`,
      notificationDetail: `${senderName} (${senderRole}): ${(message.text || message || '').slice(0, 80)}`,
      notificationType: 'Reply',
    };
  },
};
