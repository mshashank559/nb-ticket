// NetBounce Ticketing Service - Enterprise Functional Mock Layer
// API-Ready for future Node.js + Express + MongoDB + AWS backend

export const roles = [
  {
    id: "process_analyst",
    name: "Process Analyst",
    team: "Quality & Operations",
    defaultUser: "Amit Verma",
    description: "Central authority: review, assign tickets, start 24h SLA, manage breaches, grant relaxations, and manage users."
  },
  {
    id: "marketing_tl",
    name: "Marketing TL",
    team: "Marketing & Lead Gen",
    defaultUser: "Shilp Mehta",
    description: "Create marketing tickets using structured 10 topics/subtopics, resolve assigned tickets, track SLA countdown."
  },
  {
    id: "sales_tl",
    name: "Sales TL",
    team: "Sales & Placement",
    defaultUser: "Rohan Sen",
    description: "Create custom issue sales tickets, resolve assigned tickets, track SLA countdown."
  },
  {
    id: "manager",
    name: "Manager",
    team: "Executive Leadership",
    defaultUser: "Kavita Rao",
    description: "Governance oversight: review escalated breach tickets, monitor cross-team SLA compliance."
  },
];

// Exact 10 Marketing Topics & Subtopics provided by the business
export const marketingTopics = {
  "No Calls / No Interviews": [
    "Candidate is not receiving calls or interviews.",
    "Candidate is concerned about the lack of interview activity.",
    "Candidate has concerns regarding overall marketing progress.",
  ],
  "Interview / Proxy Issues": [
    "Proxy did not perform well during the interview.",
    "Proxy provided incorrect information.",
    "Candidate reports that the proxy negatively impacted the interview.",
    "Candidate has concerns regarding the proxy used.",
  ],
  "Recruiter Complaints": [
    "Candidate has a complaint regarding the recruiter.",
    "Candidate is not satisfied with the recruiter's communication or support.",
    "Candidate requests a recruiter change.",
  ],
  "Senior Recruiter / Team Lead Request": [
    "Candidate specifically requests to speak with a Senior Recruiter.",
    "Candidate specifically requests to speak with a Team Lead.",
    "The current recruiter is unable to resolve the candidate's issue.",
  ],
  "Email ID Issues": [
    "Candidate cannot access the email ID.",
    "Email is locked or blocked.",
    "Login/password-related issues.",
    "Candidate is not receiving emails.",
    "Any other issue related to the candidate's marketing email ID.",
  ],
  "BGC Issues": [
    "Candidate has an issue with the BGC process.",
    "BGC is delayed.",
    "Candidate has questions regarding BGC documents or verification.",
    "Candidate reports an issue with the BGC vendor/process.",
  ],
  "RUC Issues": [
    "Candidate has an issue related to RUC.",
    "Candidate has questions or concerns regarding RUC status/process.",
    "Candidate reports a problem with RUC-related activity.",
  ],
  "Resume / Profile Issues": [
    "Resume requires an update or correction.",
    "Candidate identifies incorrect profile information.",
    "Candidate wants to add or remove important experience, skills, or certifications.",
  ],
  "LinkedIn / Job Portal Issues": [
    "Candidate is facing an issue with LinkedIn or another job portal being used for marketing.",
    "Profile is restricted, blocked, or inaccessible.",
    "Candidate has concerns regarding job applications or profile activity.",
  ],
  "Wrong / Duplicate Applications": [
    "Candidate reports duplicate applications.",
    "Candidate receives an application for a position that does not match their profile.",
    "Candidate has concerns regarding incorrect application information.",
  ],
};

// Backwards compatibility alias for categories
export const categories = marketingTopics;

// Prohibited ticket creation reasons for Marketing TL
export const prohibitedMarketingTickets = [
  "Checking the internal marketing process.",
  "Direct communication with Recruiters or Senior Recruiters – strictly prohibited.",
  "Requesting calls for slot payments.",
  "Routine process/status updates.",
  "Following up on individual recruiter performance.",
  "Requesting special treatment for a particular candidate.",
];

// Initial Users for User Management (Process Analyst can manage and add new TLs)
export const initialUsers = [
  {
    id: "USR-102",
    name: "Shashank Mishra",
    email: "mshashank559@gmail.com",
    password: "PA@123",
    role: "process_analyst",
    roleName: "Process Analyst & Admin",
    department: "Quality & Operations",
    status: "Active",
    ticketsCount: 0,
    createdAt: "28 Sept 2026",
  },
  {
    id: "USR-107",
    name: "Aditi Mohapatra",
    email: "aditi.m@netbounceplacement.com",
    password: "PA@123",
    role: "process_analyst",
    roleName: "Process Analyst",
    department: "Quality & Operations",
    status: "Active",
    ticketsCount: 28,
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
    status: "Active",
    ticketsCount: 5,
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
    status: "Active",
    ticketsCount: 18,
    createdAt: "15 Jan 2026",
  },
  {
    id: "USR-105",
    name: "Shivam Barot",
    email: "shivam.b@netbounceplacemenet.com",
    password: "Sales@123",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    status: "Active",
    ticketsCount: 14,
    createdAt: "12 Jan 2026",
  },
  {
    id: "USR-103",
    name: "Mukesh Chaudhary",
    email: "mukesh.chaudhary@netbounceplacement.com",
    password: "TL@123",
    role: "marketing_tl",
    roleName: "Marketing TL",
    department: "Marketing & Lead Gen",
    status: "Active",
    ticketsCount: 9,
    createdAt: "01 Feb 2026",
  },
  {
    id: "USR-101",
    name: "Rudra Patel",
    email: "rudra.p@netbounceplacement.com",
    password: "MM@123",
    role: "manager",
    roleName: "Manager",
    department: "Executive Leadership",
    status: "Active",
    ticketsCount: 6,
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
    status: "Active",
    ticketsCount: 4,
    createdAt: "05 Jan 2026",
  },
];

// Seed Tickets covering all lifecycle states:
// - New/Unassigned (awaiting PA assignment, SLA not started)
// - Assigned/Open (24h SLA active & running)
// - Due Soon (< 1h remaining, reminder triggered)
// - Breached (in dedicated PA Breach view)
// - Relaxed (+1 Day relaxation granted by PA, original breach preserved)
// - Escalated (escalated to Manager)
// - Resolved & Closed
export const initialTickets = [];

// In-memory / LocalStorage State Store
const TICKETS_KEY = 'netbounce_tickets_v3_clean';
try {
  localStorage.removeItem('netbounce_tickets_v2');
  localStorage.removeItem('netbounce_notifs_v2');
} catch (e) {}
const USERS_KEY = 'netbounce_users_v2';
const NOTIFS_KEY = 'netbounce_notifs_v3';

export const getStoredTickets = () => {
  try {
    const data = localStorage.getItem(TICKETS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    // fallback to memory
  }
  return initialTickets;
};

export const saveStoredTickets = (ticketsList) => {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(ticketsList));
  } catch (e) {}
};

export const getStoredUsers = () => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return initialUsers;
};

export const saveStoredUsers = (usersList) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(usersList));
  } catch (e) {}
};

export const initialNotifications = [];

export const getStoredNotifications = () => {
  try {
    const data = localStorage.getItem(NOTIFS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return initialNotifications;
};

export const saveStoredNotifications = (notifs) => {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
  } catch (e) {}
};

// Activity log aggregation
export const activity = [];

export const analytics = {
  trend: [0, 0, 0, 0, 0, 0, 0],
  labels: ["18 Sep", "19 Sep", "20 Sep", "21 Sep", "22 Sep", "23 Sep", "24 Sep"],
  teams: [
    {
      name: "Marketing",
      value: 0,
      color: "#2563eb",
    },
    {
      name: "Sales",
      value: 0,
      color: "#0ea5a4",
    },
    {
      name: "Quality Ops",
      value: 0,
      color: "#f59e0b",
    },
  ],
};

// Main Exported Ticket array for direct references
export const tickets = initialTickets;

// API Base URL (empty for local proxy, or set via VITE_API_URL in production Vercel)
export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';

export const apiUrl = (endpoint) => `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

// API Service Interface (Future Backend Ready)
const syncToBackend = async (method, path = '', body = null) => {
  try {
    const res = await fetch(apiUrl(`/api/tickets${path}`), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return await res.json();
    const errText = await res.text();
    console.error(`[syncToBackend] Error ${res.status}:`, errText);
  } catch (e) {
    console.error('[syncToBackend] Network error:', e);
  }
  return null;
};

// API Service Interface (Connected to MongoDB Backend with Local Fallback)
export const ticketApi = {
  list: async () => {
    try {
      const res = await fetch(apiUrl('/api/tickets'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          saveStoredTickets(data);
          return data;
        }
      }
    } catch (e) {}
    return getStoredTickets();
  },

  get: async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/tickets/${id}`));
      if (res.ok) return await res.json();
    } catch (e) {}
    return getStoredTickets().find((t) => t.id === id);
  },
  
  create: async (payload) => {
    const list = getStoredTickets();
    const newId = `TKT-${1001 + list.length}`;
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const targetAssignee = payload.assignee && payload.assignee !== 'Unassigned' ? payload.assignee : (payload.recruiter || 'Unassigned');
    const isDirectlyAssigned = targetAssignee && targetAssignee !== 'Unassigned';
    const targetAssigneeRole = payload.assigneeRole || (isDirectlyAssigned ? (payload.team === 'Sales' || payload.creatorRole === 'sales_tl' ? 'marketing_tl' : 'sales_tl') : null);

    // Do NOT send string createdAt - let MongoDB/Mongoose set createdAt as Date
    const newTicket = {
      ...payload,
      id: newId,
      status: isDirectlyAssigned ? "In Progress" : "New",
      assignee: targetAssignee,
      assignedRole: targetAssigneeRole,
      assigneeRole: targetAssigneeRole,
      targetTeam: payload.targetTeam || (targetAssigneeRole === 'marketing_tl' ? 'Marketing' : targetAssigneeRole === 'sales_tl' ? 'Sales' : payload.team || 'Marketing'),
      assignedAt: isDirectlyAssigned ? timeStr : null,
      assignedTimestamp: isDirectlyAssigned ? Date.now() : null,
      updatedAt: new Date().toISOString(),
      sla: isDirectlyAssigned ? "24h 00m" : "Pending Assignment",
      slaState: isDirectlyAssigned ? "healthy" : "unassigned",
      created: timeStr,
      createdTimestamp: Date.now(),
      attachments: payload.attachments || [],
      thread: [
        {
          id: `msg-${Date.now()}`,
          name: payload.createdBy || "Team Lead",
          role: payload.creatorRole === "sales_tl" ? "Sales TL" : "Marketing TL",
          time: timeStr.replace('Today · ', ''),
          text: payload.description,
          mine: true,
        }
      ],
      timeline: [
        {
          id: `evt-${Date.now()}`,
          title: "Ticket Created",
          time: timeStr,
          user: payload.createdBy || "Team Lead",
          role: payload.creatorRole === "sales_tl" ? "Sales TL" : "Marketing TL",
          action: "Created",
          detail: `Ticket created and queued for Process Analyst assignment.`,
        }
      ]
    };
    
    const savedBackend = await syncToBackend('POST', '', newTicket);
    const finalTicket = savedBackend || newTicket;
    const updated = [finalTicket, ...list.filter(t => t.id !== finalTicket.id)];
    saveStoredTickets(updated);
    return finalTicket;
  },

  // Central Assignment by Process Analyst - Starts 24h SLA Timer!
  assign: async (ticketId, assigneeUser, paName = "Amit Verma") => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const deadline = new Date(Date.now() + 24 * 3600 * 1000);
    const deadlineStr = `Tomorrow · ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const roleId = assigneeUser.role || assigneeUser.roleId || (assigneeUser.name?.includes('Shilp') ? 'marketing_tl' : 'sales_tl');

    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "In Progress",
          assignee: assigneeUser.name,
          assignedRole: roleId,
          assigneeRole: roleId,
          targetTeam: roleId === 'marketing_tl' ? 'Marketing' : 'Sales',
          assignedBy: `${paName} (Process Analyst)`,
          assignedAt: timeStr,
          assignedTimestamp: Date.now(),
          updatedAt: new Date().toISOString(),
          sla: "24h 00m",
          slaState: "healthy",
          slaDeadline: deadlineStr,
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: paName,
              role: "Process Analyst",
              time: timeStr.replace('Today · ', ''),
              text: `Assigned ticket to ${assigneeUser.name} (${assigneeUser.roleName || assigneeUser.role || roleId}). 24-hour SLA countdown starts now.`,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: timeStr,
              user: paName,
              role: "Process Analyst",
              action: "Assigned & SLA Started",
              detail: `Ticket assigned to ${assigneeUser.name}. 24-hour resolution SLA activated.`,
            }
          ]
        };
      }
      return t;
    });
    
    const targetTicket = updated.find((t) => t.id === ticketId);
    // Put newly assigned ticket at top of stored tickets
    const reordered = targetTicket ? [targetTicket, ...updated.filter(t => t.id !== ticketId)] : updated;
    saveStoredTickets(reordered);

    // Call dedicated backend assign endpoint to start SLA and fire Support email
    try {
      await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: assigneeUser.name, paName, assigneeRole: roleId }),
      });
    } catch (e) {
      if (targetTicket) syncToBackend('PUT', `/${ticketId}`, targetTicket);
    }

    return targetTicket;
  },

  // PA Escalation on SLA Breach -> Moves to Manager View
  escalate: async (ticketId, paName = "Amit Verma", reason = "SLA breached and ticket escalated by Process Analyst.") => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "Escalated",
          escalatedAt: timeStr,
          escalatedBy: `${paName} (Process Analyst)`,
          escalationReason: reason,
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: paName,
              role: "Process Analyst",
              time: timeStr.replace('Today · ', ''),
              text: `⚠️ Escalated to Management: ${reason}`,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: timeStr,
              user: paName,
              role: "Process Analyst",
              action: "Escalated",
              detail: `Ticket breached SLA limit and was escalated to Manager by ${paName}.`,
            }
          ]
        };
      }
      return t;
    });

    const targetTicket = updated.find((t) => t.id === ticketId);
    saveStoredTickets(updated);

    // Call dedicated backend escalate endpoint to fire Manager Support email
    try {
      await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: paName, reason }),
      });
    } catch (e) {
      if (targetTicket) syncToBackend('PUT', `/${ticketId}`, targetTicket);
    }

    return targetTicket;
  },

  // PA 1-Day SLA Relaxation (+24 Hours) -> Preserves original breach history!
  relax: async (ticketId, paName = "Amit Verma") => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newDeadline = new Date(Date.now() + 24 * 3600 * 1000);
    const deadlineStr = `Tomorrow · ${newDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "In Progress",
          slaState: "healthy",
          sla: "24h 00m (Relaxed)",
          slaDeadline: deadlineStr,
          isRelaxed: true,
          relaxationCount: (t.relaxationCount || 0) + 1,
          relaxationGrantedAt: timeStr,
          relaxationGrantedBy: `${paName} (Process Analyst)`,
          breachedAt: t.breachedAt || timeStr, // Preserve original breach timestamp
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: paName,
              role: "Process Analyst",
              time: timeStr.replace('Today · ', ''),
              text: `Granted 1-day (+24h) SLA relaxation. Original breach history preserved in audit log. New deadline: ${deadlineStr}.`,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: timeStr,
              user: paName,
              role: "Process Analyst",
              action: "1-Day SLA Relaxation",
              detail: `1-day SLA relaxation granted. Original breach at ${t.breachedAt || timeStr} preserved. New deadline: ${deadlineStr}.`,
            }
          ]
        };
      }
      return t;
    });

    const targetTicket = updated.find((t) => t.id === ticketId);
    saveStoredTickets(updated);

    // Call dedicated backend relax endpoint to fire Extension email
    try {
      await fetch(`/api/tickets/${ticketId}/relax`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: paName, reason: "1-day extension granted by Process Analyst" }),
      });
    } catch (e) {
      if (targetTicket) syncToBackend('PUT', `/${ticketId}`, targetTicket);
    }

    return targetTicket;
  },

  // Resolve Ticket
  resolve: async (ticketId, userName, userRole = "Team Lead", notes = "") => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "Resolved",
          resolvedAt: timeStr,
          slaState: "met",
          sla: "Resolved",
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: userName,
              role: userRole,
              time: timeStr.replace('Today · ', ''),
              text: `Marked issue as resolved. Solution implemented and verified.`,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: timeStr,
              user: userName,
              role: userRole,
              action: "Resolved",
              detail: `Ticket resolved by ${userName}.`,
            }
          ]
        };
      }
      return t;
    });

    const targetTicket = updated.find((t) => t.id === ticketId);
    saveStoredTickets(updated);

    // Call dedicated backend resolve endpoint to fire Resolution email
    try {
      await fetch(`/api/tickets/${ticketId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userRole, notes: notes || "Solution implemented and verified." }),
      });
    } catch (e) {
      if (targetTicket) syncToBackend('PUT', `/${ticketId}`, targetTicket);
    }

    return targetTicket;
  },

  // Reopen Ticket (for Marketing TL / Sales TL / Process Analyst)
  reopen: async (ticketId, userName, userRole = "Team Lead", reason = "Resolution not satisfactory.") => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `Today · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const deadline = new Date(Date.now() + 24 * 3600 * 1000);
    const deadlineStr = `Tomorrow · ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "In Progress",
          reopenedAt: timeStr,
          reopenedBy: `${userName} (${userRole})`,
          reopenReason: reason,
          slaState: "healthy",
          sla: "24h 00m",
          slaDeadline: deadlineStr,
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: userName,
              role: userRole,
              time: timeStr.replace('Today · ', ''),
              text: `🔄 Reopened Ticket: ${reason || 'Resolution was not satisfactory. Reopened for further action.'}`,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: timeStr,
              user: userName,
              role: userRole,
              action: "Ticket Reopened",
              detail: `Ticket reopened by ${userName} (${userRole}). Reason: ${reason || 'Resolution not satisfactory'}.`,
              type: "reopen",
            }
          ]
        };
      }
      return t;
    });

    const targetTicket = updated.find((t) => t.id === ticketId);
    saveStoredTickets(updated);

    // Sync reopen to backend using dedicated endpoint
    try {
      await fetch(`/api/tickets/${ticketId}/reopen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userRole, reason }),
      });
    } catch (e) {
      console.warn('[reopen] Backend sync failed, local state updated', e);
    }

    // Create system notification for all relevant users
    try {
      const currentNotifs = getStoredNotifications();
      const newNotif = {
        id: `notif-${Date.now()}`,
        type: 'Breach',
        title: `Ticket ${ticketId} Reopened`,
        detail: `${userName} (${userRole}) reopened ticket "${targetTicket?.title || ticketId}". Reason: ${reason || 'Issue not resolved satisfactorily'}.`,
        time: 'Just now',
        unread: true,
      };
      saveStoredNotifications([newNotif, ...currentNotifs]);
    } catch (e) {}

    return targetTicket;
  },

  // Add Message to thread
  addReply: async (ticketId, userName, userRole, text) => {
    const list = getStoredTickets();
    const now = new Date();
    const timeStr = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const updated = list.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          thread: [
            ...(t.thread || []),
            {
              id: `msg-${Date.now()}`,
              name: userName,
              role: userRole,
              time: timeStr,
              text,
              mine: true,
            }
          ],
          timeline: [
            ...(t.timeline || []),
            {
              id: `evt-${Date.now()}`,
              time: `Today · ${timeStr}`,
              user: userName,
              role: userRole,
              action: "Reply Added",
              detail: `${userName} contributed to the continuous thread.`,
            }
          ]
        };
      }
      return t;
    });

    const targetTicket = updated.find((t) => t.id === ticketId);
    saveStoredTickets(updated);

    // Call dedicated backend messages endpoint to send real email through Centralized Support Email
    try {
      await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: userName,
          role: userRole,
          text,
          authorEmail: targetTicket?.candidateEmail || undefined,
        }),
      });
    } catch (e) {
      if (targetTicket) syncToBackend('PUT', `/${ticketId}`, targetTicket);
    }

    return targetTicket;
  },

  // Delete Ticket permanently from MongoDB and Local Cache
  delete: async (ticketId) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
      if (res.ok) console.log(`[Ticket Deleted from DB] ${ticketId}`);
    } catch (e) {
      console.warn('Backend delete sync failed, updating local state', e);
    }
    const list = getStoredTickets().filter((t) => t.id !== ticketId);
    saveStoredTickets(list);
    return true;
  },
};

// API Service Interface for Users connected to MongoDB
export const userApi = {
  list: async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          saveStoredUsers(data);
          return data;
        }
      }
    } catch (e) {}
    return getStoredUsers();
  },

  create: async (user) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      if (res.ok) {
        const saved = await res.json();
        const current = getStoredUsers();
        saveStoredUsers([...current, saved]);
        return saved;
      }
    } catch (e) {}
    const current = getStoredUsers();
    const newUser = { ...user, id: `USR-${101 + current.length}` };
    saveStoredUsers([...current, newUser]);
    return newUser;
  },

  update: async (updatedUser) => {
    try {
      const res = await fetch(`/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
      if (res.ok) {
        const saved = await res.json();
        const list = getStoredUsers().map((u) => u.id === updatedUser.id ? saved : u);
        saveStoredUsers(list);
        return saved;
      }
    } catch (e) {
      console.warn('Backend update user failed, updating local state', e);
    }
    const list = getStoredUsers().map((u) => u.id === updatedUser.id ? updatedUser : u);
    saveStoredUsers(list);
    return updatedUser;
  },

  delete: async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) console.log(`[User Deleted from DB] ${userId}`);
    } catch (e) {
      console.warn('Backend delete user failed, updating local state', e);
    }
    const list = getStoredUsers().filter((u) => u.id !== userId);
    saveStoredUsers(list);
    return true;
  },
};

// Real Notification API Service (MongoDB backed with local fallback)
export const notificationApi = {
  list: async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          saveStoredNotifications(data);
          return data;
        }
      }
    } catch (e) {}
    return getStoredNotifications();
  },
  markRead: async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {}
  },
  markAllRead: async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch (e) {}
  },
};

