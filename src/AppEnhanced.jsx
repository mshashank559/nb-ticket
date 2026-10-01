import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
} from 'react-router-dom';
import {
  CircleAlert,
  Ellipsis,
  Filter,
  Sparkles,
  UserRound,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  Users,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Send,
  UserCheck,
  ShieldAlert,
  Info as InfoIcon,
  Radio,
  X,
  Download,
  Eye,
  Image,
  FileSpreadsheet,
  Trash2,
  Pencil,
  KeyRound,
  RotateCcw,
  RefreshCw,
  Lock,
} from 'lucide-react';

import { SecurityBlockedModal } from './components/SecurityBlockedModal';
import {
  isClientMobile,
  getOrCreateDeviceId,
  getDeviceFriendlyName,
  evaluateClientSchedule,
  securityApi,
  isProcessTeamStation,
  markProcessTeamStation,
} from './services/securityService';

import {
  roles,
  marketingTopics,
  prohibitedMarketingTickets,
  getStoredTickets,
  saveStoredTickets,
  getStoredUsers,
  saveStoredUsers,
  getStoredNotifications,
  saveStoredNotifications,
  activity as seedActivity,
  analytics,
  ticketApi,
  userApi,
  notificationApi,
} from './services/mockTicketService';
import './App.css';
import './login-premium.css';
import nbLogo from './nb-logo.png';
import nbBounceLogo from './nb-bounce-logo.png';
import logoDark from './logo-dark.png';
import { io } from 'socket.io-client';

const slugs = {
  my: null,
  live: 'All statuses',
  open: 'Open',
  'in-progress': 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const id = (text) => String(text).toLowerCase().replaceAll(' ', '-');

// Helper to determine if a ticket is visible to a role and current user (Strict Isolation)
export function isTicketForRole(ticket, role, currentUser, usersList = null) {
  if (!ticket || !role) return true;
  if (role.id === 'process_analyst') return true;

  const users = usersList || getStoredUsers() || [];

  const currentName = typeof currentUser === 'string'
    ? currentUser.trim().toLowerCase()
    : (currentUser?.name || '').trim().toLowerCase();

  const authUserStr = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('authUser') : null;
  const authUser = authUserStr ? JSON.parse(authUserStr) : (typeof currentUser === 'object' ? currentUser : null);

  // Find user document in users directory
  const userDoc = users.find((u) =>
    (currentName && u.name?.trim().toLowerCase() === currentName) ||
    (authUser?.email && u.email?.trim().toLowerCase() === authUser.email.trim().toLowerCase())
  );

  const effectiveEmail = (userDoc?.email || authUser?.email || '').trim().toLowerCase();

  const assigneeName = (ticket.assignee || '').trim().toLowerCase();
  const recruiterName = (ticket.recruiter || '').trim().toLowerCase();
  const salesRepName = (ticket.salesRep || '').trim().toLowerCase();
  const createdByName = (ticket.createdBy || ticket.creatorName || '').trim().toLowerCase();
  const salesPoc = (ticket.salesPoc || '').trim().toLowerCase();
  const marketingEmail = (ticket.marketingTlEmail || '').trim().toLowerCase();

  const isDirectParticipant = (
    (currentName && (
      assigneeName === currentName ||
      recruiterName === currentName ||
      salesRepName === currentName ||
      createdByName === currentName ||
      salesPoc === currentName
    )) ||
    (effectiveEmail && (
      salesPoc === effectiveEmail ||
      marketingEmail === effectiveEmail ||
      assigneeName === effectiveEmail
    ))
  );

  // Sales TL and Marketing TL can ONLY access tickets where they are a direct participant
  if (role.id === 'marketing_tl' || role.id === 'sales_tl') {
    return isDirectParticipant;
  }

  // Manager: strictly reporting hierarchy (their direct reportees' tickets) + escalated to them
  if (role.id === 'manager') {
    const escalatedToName = (ticket.escalatedTo || '').trim().toLowerCase();
    if (escalatedToName && currentName && escalatedToName.includes(currentName)) {
      return true;
    }
    if (isDirectParticipant) return true;

    // Find all users who report to this manager
    const reportees = users.filter((u) => {
      const mgrName = (u.manager || '').trim().toLowerCase();
      const mgrEmail = (u.managerEmail || '').trim().toLowerCase();
      const mgrId = u.managerId;
      return (
        (currentName && mgrName === currentName) ||
        (effectiveEmail && mgrEmail === effectiveEmail) ||
        (userDoc?.id && mgrId === userDoc.id)
      );
    });

    if (reportees.length > 0) {
      const reporteeNames = new Set(reportees.map((u) => (u.name || '').trim().toLowerCase()).filter(Boolean));
      const reporteeEmails = new Set(reportees.map((u) => (u.email || '').trim().toLowerCase()).filter(Boolean));

      return (
        reporteeNames.has(createdByName) ||
        reporteeNames.has(assigneeName) ||
        reporteeNames.has(recruiterName) ||
        reporteeNames.has(salesRepName) ||
        reporteeEmails.has(salesPoc) ||
        reporteeEmails.has(marketingEmail)
      );
    }

    // Fallback: match by manager's department/team if reportees not explicitly configured
    const userDept = (userDoc?.department || '').toLowerCase();
    const ticketTeam = (ticket.team || ticket.targetTeam || '').toLowerCase();
    if (userDept && ticketTeam && userDept.includes(ticketTeam)) {
      return true;
    }
    return true;
  }

  return isDirectParticipant;
}

export function Avatar({ name = 'Shilp', small = false }) {
  return (
    <span
      data-testid={`avatar-${id(name)}`}
      className={`avatar ${small ? 'avatar-small' : ''}`}
    >
      {name
        .split(' ')
        .map((x) => x[0])
        .join('')
        .slice(0, 2)}
    </span>
  );
}

export function Button({
  children,
  icon: Icon,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function Badge({ children, type = 'neutral' }) {
  return (
    <span data-testid={`badge-${id(children)}`} className={`badge badge-${type}`}>
      {children}
    </span>
  );
}

export function Header({ title, currentRole, currentUser, onSignOut, notifications = [] }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button data-testid="mobile-menu-button" className="mobile-menu icon-button">
          <Menu size={20} />
        </button>
        <div>
          <div className="breadcrumb">
            <span>NetBounce</span>
            <ChevronRight size={13} />
            <span className={`role-pill ${currentRole.id}`}>{currentRole.name}</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="global-search">
          <Search size={16} />
          <input data-testid="global-search-input" placeholder="Search tickets, candidate..." />
          <kbd>⌘ K</kbd>
        </div>
        <button
          data-testid="header-notifications-button"
          className="icon-button notification-button"
          style={{ position: 'relative' }}
          onClick={() => navigate('/notifications')}
          title="Notifications"
        >
          <Bell size={19} />
          {unreadCount > 0 ? (
            <span style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: '700',
              padding: '1px 5px',
              borderRadius: '10px',
              lineHeight: '1.2',
            }}>{unreadCount}</span>
          ) : (
            <i />
          )}
        </button>
        <div className="profile-menu-wrapper" style={{ position: 'relative' }}>
          <div
            className="profile-menu"
            onClick={() => setProfileOpen(!profileOpen)}
            style={{ cursor: 'pointer' }}
          >
            <Avatar name={currentUser} small />
            <div>
              <strong>{currentUser}</strong>
              <span className={`role-pill ${currentRole.id}`}>{currentRole.name}</span>
            </div>
            <ChevronDown size={15} />
          </div>
          {profileOpen && (
            <div className="profile-dropdown" style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '8px',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '10px',
              boxShadow: '0 12px 30px rgba(15, 29, 53, 0.12)',
              padding: '12px',
              minWidth: '220px',
              zIndex: 100,
            }}>
              <div style={{ padding: '4px 6px 10px', borderBottom: '1px solid var(--line)' }}>
                <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>{currentUser}</strong>
                <span className={`role-pill ${currentRole.id}`} style={{ display: 'inline-block', marginTop: '6px' }}>{currentRole.name}</span>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{currentRole.team}</div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  data-testid="signout-button"
                  className="profile-dropdown-item signout-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    background: 'transparent',
                    border: 0,
                    borderRadius: '6px',
                    color: 'var(--red)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => { setProfileOpen(false); onSignOut && onSignOut(); }}
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function Sidebar({ role, setRole, currentUser, tickets = [] }) {
  const [collapsed, setCollapsed] = useState(false);
  const userTickets = useMemo(() => {
    return role.id === 'process_analyst'
      ? tickets
      : tickets.filter((t) => isTicketForRole(t, role, currentUser));
  }, [tickets, role, currentUser]);

  const breachedCount = userTickets.filter((t) => t.slaState === 'breached' || t.status === 'Escalated').length;
  const unassignedCount = userTickets.filter((t) => t.status === 'New' || t.assignee === 'Unassigned').length;
  const liveCount = userTickets.filter((t) => t.status !== 'Closed').length;
  const mktLiveCount = userTickets.filter((t) => t.status !== 'Closed').length;
  const salesLiveCount = userTickets.filter((t) => t.status !== 'Closed').length;

  // Build dynamic navigation based strictly on active user role
  const groups = useMemo(() => {
    if (role.id === 'process_analyst') {
      return [
        {
          label: 'Operations & SLA',
          items: [
            ['/dashboard', 'Dashboard', LayoutDashboard],
            ['/live-queue', 'Live Queue', Radio, liveCount],
            ['/tickets', 'All Tickets', LifeBuoy, tickets.length],
            ['/breaches', 'SLA Breaches', AlertTriangle, breachedCount > 0 ? breachedCount : null],
            ['/notifications', 'Notifications', Bell],
          ],
        },
        {
          label: 'Organization',
          items: [
            ['/users', 'User Management', Users],
          ],
        },
        {
          label: 'Insights',
          items: [
            ['/analytics', 'Analytics', TrendingUp],
            ['/activity', 'Activity log', FileText],
          ],
        },
        {
          label: 'System',
          items: [['/settings', 'Settings', Settings]],
        },
      ];
    }

    if (role.id === 'marketing_tl') {
      return [
        {
          label: 'Marketing Workspace',
          items: [
            ['/dashboard', 'Dashboard', LayoutDashboard],
            ['/live-queue', 'Live Queue', Radio, mktLiveCount],
            ['/tickets', 'Marketing Tickets', LifeBuoy],
            ['/tickets/new', 'Create Ticket', Plus],
            ['/notifications', 'Notifications', Bell],
          ],
        },
        {
          label: 'Insights',
          items: [
            ['/analytics', 'Analytics', TrendingUp],
            ['/activity', 'Activity log', FileText],
          ],
        },
        {
          label: 'Account',
          items: [['/settings', 'Settings', Settings]],
        },
      ];
    }

    if (role.id === 'sales_tl') {
      return [
        {
          label: 'Sales Workspace',
          items: [
            ['/dashboard', 'Dashboard', LayoutDashboard],
            ['/live-queue', 'Live Queue', Radio, salesLiveCount],
            ['/tickets', 'Sales Tickets', LifeBuoy],
            ['/tickets/new', 'Create Ticket', Plus],
            ['/notifications', 'Notifications', Bell],
          ],
        },
        {
          label: 'Insights',
          items: [
            ['/analytics', 'Analytics', TrendingUp],
            ['/activity', 'Activity log', FileText],
          ],
        },
        {
          label: 'Account',
          items: [['/settings', 'Settings', Settings]],
        },
      ];
    }

    // Manager View
    return [
      {
        label: 'Governance & Leadership',
        items: [
          ['/dashboard', 'Dashboard', LayoutDashboard],
          ['/live-queue', 'Live Queue', Radio, liveCount],
          ['/tickets/escalated', 'Escalated Queue', CircleAlert, breachedCount],
          ['/tickets', 'All Team Tickets', LifeBuoy],
          ['/notifications', 'Notifications', Bell],
        ],
      },
      {
        label: 'Insights',
        items: [
          ['/analytics', 'Analytics', TrendingUp],
          ['/activity', 'Activity log', FileText],
        ],
      },
      {
        label: 'System',
        items: [['/settings', 'Settings', Settings]],
      },
    ];
  }, [role.id, tickets.length, breachedCount, liveCount, mktLiveCount, salesLiveCount]);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <img src={logoDark} alt="NetBounce" className="sidebar-logo-img" />
        </div>
      </div>
      <div className="workspace-switcher">
        <span className="workspace-dot" />
        <span className="workspace-name">{role.team}</span>
        <ChevronDown size={14} />
      </div>
      <nav>
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(([to, label, Icon, count]) => (
              <NavLink
                to={to}
                data-testid={`nav-${id(label)}`}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                key={to}
              >
                <Icon size={17} />
                <span>{label}</span>
                {count !== undefined && count !== null && count !== false && (
                  <small style={label === 'SLA Breaches' ? { background: '#ef4444', color: '#fff' } : {}}>
                    {count}
                  </small>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-help">
        <CircleAlert size={17} />
        <div>
          <strong>SLA Governance</strong>
          <span>24-Hour Resolution Policy</span>
        </div>
      </div>
      <div className="sidebar-user">
        <Avatar name={currentUser} small />
        <div className="sidebar-user-text">
          <strong>{currentUser}</strong>
          <span>{role.name}</span>
        </div>
      </div>
      <button
        data-testid="sidebar-collapse-button"
        className="collapse-button"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronLeft size={16} />
        <span>Collapse sidebar</span>
      </button>
    </aside>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function TicketTable({ rows, currentRole, onAssign, onEscalate, onRelax, onDeleteTicket }) {
  const navigate = useNavigate();

  return (
    <div className="table-wrap">
      <table data-testid="ticket-table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Issue / Topic</th>
            <th>Candidate</th>
            <th>Team</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>SLA Status</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              data-testid={`ticket-row-${t.id}`}
              onClick={() => navigate(`/tickets/${t.id}`)}
              key={t.id}
            >
              <td>
                <strong className="ticket-id">{t.id}</strong>
                <small>{t.createdAt || t.updated}</small>
              </td>
              <td>
                <strong>{t.title}</strong>
                <small>{t.subCategory || t.category}</small>
              </td>
              <td>
                <strong>{t.candidate}</strong>
                <small>{t.email}</small>
              </td>
              <td>
                {t.team}
                <small>{t.subTeam}</small>
              </td>
              <td>
                <Badge type={t.priority ? t.priority.toLowerCase() : 'medium'}>{t.priority}</Badge>
              </td>
              <td>
                {t.assignee === 'Unassigned' ? (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>
                    Unassigned
                  </span>
                ) : (
                  <span>{t.assignee}</span>
                )}
              </td>
              <td>
                <Badge type={t.status ? t.status.toLowerCase().replaceAll(' ', '-') : 'new'}>
                  {t.status}
                </Badge>
              </td>
              <td>
                {t.slaState === 'unassigned' ? (
                  <span className="sla-text" style={{ color: '#64748b' }}>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Pending Assignment
                  </span>
                ) : t.slaState === 'breached' ? (
                  <span className="sla-text breached">
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {t.sla}
                  </span>
                ) : t.slaState === 'due' ? (
                  <span className="sla-text due">
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {t.sla} (Due Soon)
                  </span>
                ) : (
                  <span className="sla-text healthy">
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {t.sla}
                  </span>
                )}
              </td>
              <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <button
                  title="Delete Ticket from Database"
                  className="icon-button"
                  style={{
                    color: '#dc2626',
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onClick={() => onDeleteTicket && onDeleteTicket(t.id)}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard({ role, currentUser, tickets, onAssign, onEscalate, onRelax }) {
  const navigate = useNavigate();

  const authorizedTickets = useMemo(() => {
    return role.id === 'process_analyst'
      ? tickets
      : tickets.filter((t) => isTicketForRole(t, role, currentUser));
  }, [role.id, tickets, currentUser]);

  // Role-filtered attention items
  const attentionTickets = useMemo(() => {
    let result = [];
    if (role.id === 'process_analyst') {
      result = tickets.filter((t) => t.status === 'New' || t.slaState === 'breached' || t.slaState === 'due');
    } else if (role.id === 'manager') {
      result = authorizedTickets.filter((t) => t.status === 'Escalated' || t.slaState === 'breached');
    } else {
      result = authorizedTickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed');
    }
    // Always sort newly assigned / newest created tickets on the TOP!
    return result.sort((a, b) => {
      const timeA = new Date(a.assignedAt || a.updatedAt || a.createdAt || a.createdTimestamp || 0).getTime();
      const timeB = new Date(b.assignedAt || b.updatedAt || b.createdAt || b.createdTimestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [role.id, tickets, authorizedTickets]);

  const metrics = useMemo(() => {
    const list = authorizedTickets;
    const total = list.length;
    const unassigned = list.filter((t) => t.status === 'New' || t.assignee === 'Unassigned').length;
    const inProgress = list.filter((t) => t.status === 'In Progress' || t.status === 'Open').length;
    const resolved = list.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
    const breached = list.filter((t) => t.slaState === 'breached').length;
    const escalated = list.filter((t) => t.status === 'Escalated').length;

    if (role.id === 'process_analyst') {
      return [
        ['Total tickets', String(total), LifeBuoy, 'Across all teams'],
        ['Awaiting Assignment', String(unassigned), Clock3, 'SLA starts upon assignment'],
        ['Active in SLA', String(inProgress), Zap, '24h window active'],
        ['SLA Breaches', String(breached), AlertTriangle, 'Requires PA action'],
        ['Escalated', String(escalated), CircleAlert, 'Under Manager review'],
      ];
    }
    if (role.id === 'manager') {
      return [
        ['Escalated Queue', String(escalated), CircleAlert, 'Immediate review'],
        ['Total Breaches', String(breached), AlertTriangle, 'Policy non-compliant'],
        ['In Progress', String(inProgress), Zap, 'Reporting team execution'],
        ['Resolved', String(resolved), ShieldCheck, 'Closed successfully'],
        ['Total Volume', String(total), LifeBuoy, 'In your reporting scope'],
      ];
    }
    if (role.id === 'marketing_tl') {
      const mktOpen = list.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;
      return [
        ['Marketing Tickets', String(total), LifeBuoy, 'Assigned / Raised by you'],
        ['Open / In Progress', String(mktOpen), Clock3, 'Working on issue'],
        ['Resolved', String(resolved), ShieldCheck, 'Within committed SLA'],
        ['Breaches', String(breached), CircleAlert, 'Escalated to PA'],
        ['Active Pipeline', String(mktOpen), Zap, 'Your active tickets'],
      ];
    }
    // Sales TL
    const salesOpen = list.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;
    return [
      ['Sales Tickets', String(total), LifeBuoy, 'Custom concerns'],
      ['Open / In Progress', String(salesOpen), Clock3, 'Assigned to Sales'],
      ['Resolved', String(resolved), ShieldCheck, 'Successfully placed'],
      ['Breaches', String(breached), CircleAlert, 'Cross-team sync'],
      ['Active Pipeline', String(salesOpen), Zap, 'Your active tickets'],
    ];
  }, [role.id, authorizedTickets]);

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="NETBOUNCE WORKSPACE"
        title={`Welcome back, ${currentUser}`}
        subtitle={
          role.id === 'process_analyst'
            ? 'Process Analyst Console: Review incoming tickets, assign TLs to initiate 24h SLA, and govern breaches.'
            : role.id === 'manager'
            ? 'Manager Governance Dashboard: Overseeing escalated queues and SLA breach compliance.'
            : role.id === 'marketing_tl'
            ? 'Marketing TL Dashboard: Track candidate marketing issues and manage resolution SLAs.'
            : 'Sales TL Dashboard: Create and resolve custom placement & sales operational concerns.'
        }
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            {role.id === 'process_analyst' && (
              <Button
                variant="secondary"
                icon={Users}
                onClick={() => navigate('/users')}
              >
                User Management
              </Button>
            )}
            {(role.id === 'marketing_tl' || role.id === 'sales_tl' || role.id === 'process_analyst') && (
              <Button
                data-testid="dashboard-create-ticket-button"
                icon={Plus}
                onClick={() => navigate('/tickets/new')}
              >
                {role.id === 'marketing_tl' ? 'Create Marketing Ticket' : role.id === 'sales_tl' ? 'Create Sales Ticket' : 'Create Ticket'}
              </Button>
            )}
          </div>
        }
      />

      <div className="metrics-grid">
        {metrics.map(([label, value, Icon, hint]) => {
          const kpiKey = id(label);
          return (
            <div
              className={`metric-card kpi-${kpiKey}`}
              data-kpi={kpiKey}
              data-testid={`metric-${kpiKey}`}
              key={label}
            >
              <div className="metric-icon">
                <Icon size={18} />
              </div>
              <div className="metric-label">{label}</div>
              <strong>{value}</strong>
              <span className="metric-hint">{hint}</span>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="section-panel attention-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PRIORITY QUEUE</p>
              <h2>
                {role.id === 'process_analyst'
                  ? 'Items Requiring Process Analyst Action'
                  : role.id === 'manager'
                  ? 'Escalated Breaches & Critical Issues'
                  : 'Your Active SLA Queue'}
              </h2>
            </div>
            <button
              data-testid="view-all-attention-button"
              className="text-button"
              onClick={() => navigate(role.id === 'process_analyst' ? '/breaches' : '/tickets')}
            >
              View all <ChevronRight size={15} />
            </button>
          </div>
          <div className="attention-list">
            {attentionTickets.slice(0, 5).map((t) => (
              <button
                data-testid={`attention-${t.id}`}
                className="attention-row"
                onClick={() => navigate(`/tickets/${t.id}`)}
                key={t.id}
              >
                <span className={`attention-icon ${t.slaState || 'due'}`}>
                  {t.status === 'New' || t.assignee === 'Unassigned' ? (
                    <Clock size={16} />
                  ) : (
                    <CircleAlert size={16} />
                  )}
                </span>
                <span className="attention-main">
                  <strong>
                    {t.status === 'New'
                      ? 'New Ticket · Awaiting Assignment'
                      : t.slaState === 'breached'
                      ? 'SLA Breached'
                      : t.slaState === 'due'
                      ? 'SLA Due Soon'
                      : 'Active Ticket'}{' '}
                    <em>· {t.id}</em>
                  </strong>
                  <small>
                    {t.title} · {t.candidate} ({t.team})
                  </small>
                </span>
                <span className="attention-time">
                  {t.status === 'New' ? 'Pending Assignment' : t.sla}
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
            {attentionTickets.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--green)', margin: '0 auto 8px', display: 'block' }} />
                All SLAs are in healthy state. No priority interventions required.
              </div>
            )}
          </div>
        </section>

        <section className="section-panel sla-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SERVICE LEVEL</p>
              <h2>24-Hour SLA Performance</h2>
            </div>
          </div>
          {(() => {
            const list = authorizedTickets;
            const withinSla = list.filter(t => t.slaState === 'healthy' || t.slaState === 'met').length;
            const slaPercent = list.length > 0 ? Math.round((withinSla / list.length) * 100) : 0;
            return (
              <div className="sla-content">
                <div
                  className="ring"
                  style={{
                    background: slaPercent > 0
                      ? `conic-gradient(var(--blue) 0 ${slaPercent}%, #e8eef6 ${slaPercent}% 100%)`
                      : '#e8eef6'
                  }}
                >
                  <div>
                    <strong>{slaPercent}%</strong>
                    <span>Within SLA</span>
                  </div>
                </div>
                <div className="sla-legend">
                  <div>
                    Within SLA <strong>{withinSla}</strong>
                  </div>
                  <div>
                    Due Soon (&lt;1h) <strong>{list.filter(t => t.slaState === 'due').length}</strong>
                  </div>
                  <div>
                    Breached <strong>{list.filter(t => t.slaState === 'breached').length}</strong>
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '7px', fontSize: '11px', color: '#64748b' }}>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>Assignment Rule:</span> The 24-hour SLA starts strictly when the Process Analyst assigns the ticket to a Team Lead.
          </div>
        </section>
      </div>
    </div>
  );
}

export function TicketsPage({ routeFilter, role, currentUser, tickets, onDeleteTicket }) {
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState('');
  const [status, setStatus] = useState(slugs[routeFilter] || 'All statuses');

  const visible = useMemo(() => {
    let list = tickets;
    // Strict Role scoping
    if (role.id === 'process_analyst') {
      // Process analyst sees all tickets
    } else {
      list = list.filter((t) => isTicketForRole(t, role, currentUser));
      if (role.id === 'manager' && routeFilter === 'escalated') {
        list = list.filter((t) => t.status === 'Escalated' || t.slaState === 'breached');
      }
    }

    if (routeFilter === 'live') {
      list = list.filter((t) => t.status !== 'Closed');
    }

    const filtered = list.filter(
      (t) =>
        (!localSearch ||
          `${t.id} ${t.title} ${t.candidate} ${t.email} ${t.category} ${t.assignee} ${t.recruiter || ''}`
            .toLowerCase()
            .includes(localSearch.toLowerCase())) &&
        (status === 'All statuses' || t.status === status)
    );

    // CRITICAL: Newly assigned or created tickets ALWAYS appear at the very TOP of the Live Queue
    return filtered.sort((a, b) => {
      const timeA = new Date(a.assignedAt || a.updatedAt || a.createdAt || a.createdTimestamp || 0).getTime();
      const timeB = new Date(b.assignedAt || b.updatedAt || b.createdAt || b.createdTimestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [tickets, role.id, currentUser, routeFilter, localSearch, status]);

  const pageTitle = useMemo(() => {
    if (routeFilter === 'live') return 'Live Operational Queue';
    if (routeFilter === 'escalated') return 'Escalated Tickets Queue';
    if (role.id === 'marketing_tl') return 'Marketing Tickets';
    if (role.id === 'sales_tl') return 'Sales Tickets';
    if (role.id === 'process_analyst') return 'All Tickets (PA Queue)';
    return 'All Team Tickets';
  }, [role.id, routeFilter]);

  const pageSubtitle = useMemo(() => {
    if (routeFilter === 'live') return 'Real-time operational stream of incoming and active SLA candidate tickets.';
    if (routeFilter === 'escalated') return 'Breached tickets escalated to Management for review and intervention.';
    if (role.id === 'marketing_tl') return 'Manage, track, and resolve candidate marketing operations tickets.';
    if (role.id === 'sales_tl') return 'Placement & interview coordination tickets for the Sales team.';
    if (role.id === 'process_analyst') return 'Review incoming tickets, assign TLs to start 24h SLA, and manage breaches.';
    return 'Track, review, and manage operational tickets across teams.';
  }, [role.id, routeFilter]);

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="WORKSPACE / TICKETS"
        title={pageTitle}
        subtitle={pageSubtitle}
        action={
          (role.id === 'marketing_tl' || role.id === 'sales_tl' || role.id === 'process_analyst') && (
            <Button
              data-testid="tickets-create-button"
              icon={Plus}
              onClick={() => navigate('/tickets/new')}
            >
              {role.id === 'marketing_tl' ? 'Create Marketing Ticket' : role.id === 'sales_tl' ? 'Create Sales Ticket' : 'Create Ticket'}
            </Button>
          )
        }
      />
      <div className="ticket-toolbar">
        <div className="local-search">
          <Search size={16} />
          <input
            data-testid="tickets-search-input"
            placeholder="Search tickets, candidate, email, ID, or assignee…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <select
          data-testid="tickets-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>All statuses</option>
          {['New', 'Open', 'In Progress', 'Escalated', 'Resolved', 'Closed'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button data-testid="tickets-filter-button" className="button button-secondary">
          <Filter size={16} /> Filters
        </button>
        <button data-testid="tickets-sort-button" className="icon-button bordered">
          <SlidersHorizontal size={17} />
        </button>
      </div>
      <div className="active-filters">
        <span>Active filters</span>
        <Badge type="filter">All Active Periods</Badge>
        {status !== 'All statuses' && <Badge type="filter">{status}</Badge>}
        <button
          data-testid="clear-filters-button"
          className="text-button"
          onClick={() => {
            setLocalSearch('');
            setStatus('All statuses');
          }}
        >
          Clear all
        </button>
      </div>
      <section className="section-panel ticket-list-panel">
        <div className="list-summary">
          <span>
            <strong>{visible.length}</strong> tickets
          </span>
        </div>
        {visible.length ? (
          <TicketTable rows={visible} currentRole={role} onDeleteTicket={onDeleteTicket} />
        ) : (
          <div className="empty-state" data-testid="empty-state">
            <FileText size={21} />
            <strong>No tickets match your search</strong>
            <span>Try adjusting your search or filters.</span>
          </div>
        )}
      </section>
    </div>
  );
}

// Dedicated Breach / Overdue View for Process Analyst
export function BreachPage({ tickets, onEscalate, onRelax }) {
  const navigate = useNavigate();
  const breachedTickets = useMemo(
    () => tickets.filter((t) => t.slaState === 'breached' || t.status === 'Escalated'),
    [tickets]
  );

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="SLA GOVERNANCE / OVERDUE"
        title="SLA Breaches & Overdue Tickets"
        subtitle="Dedicated Process Analyst console for tickets where 24h SLA expired without resolution. Escalate to Management or Grant 1-Day Relaxation."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '22px' }}>
        <div className="metric-card">
          <div className="metric-icon tone-red">
            <AlertTriangle size={18} />
          </div>
          <div className="metric-label">Active SLA Breaches</div>
          <strong>{breachedTickets.filter(t => t.status !== 'Escalated').length}</strong>
          <span className="metric-hint">Require Escalate or Relaxation</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-indigo">
            <CircleAlert size={18} />
          </div>
          <div className="metric-label">Escalated to Manager</div>
          <strong>{breachedTickets.filter(t => t.status === 'Escalated').length}</strong>
          <span className="metric-hint">Manager queue active</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-teal">
            <ShieldCheck size={18} />
          </div>
          <div className="metric-label">Relaxations Granted</div>
          <strong>{tickets.filter(t => t.isRelaxed).length}</strong>
          <span className="metric-hint">+1 Day added, breach preserved</span>
        </div>
      </div>

      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BREACH AUDIT QUEUE</p>
            <h2>Breached Tickets Needing Action</h2>
          </div>
        </div>

        {breachedTickets.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
            <strong>No active SLA breaches!</strong>
            <span>All tickets are currently within compliance targets.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Candidate</th>
                  <th>Issue / Concern</th>
                  <th>Assigned TL</th>
                  <th>Team</th>
                  <th>SLA Deadline</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Available Actions</th>
                </tr>
              </thead>
              <tbody>
                {breachedTickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong className="ticket-id" style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                        {t.id}
                      </strong>
                      <small>{t.createdAt}</small>
                    </td>
                    <td>
                      <strong>{t.candidate}</strong>
                      <small>{t.email}</small>
                    </td>
                    <td>
                      <strong>{t.title}</strong>
                      <small>{t.subCategory || t.category}</small>
                    </td>
                    <td>{t.assignee}</td>
                    <td>{t.team}</td>
                    <td>
                      <span className="sla-text breached">{t.slaDeadline || 'Breached'}</span>
                    </td>
                    <td>
                      <Badge type={t.status.toLowerCase().replaceAll(' ', '-')}>{t.status}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {t.status !== 'Escalated' && (
                          <button
                            className="button button-secondary btn-escalate"
                            style={{ padding: '6px 10px', fontSize: '11px' }}
                            onClick={() => onEscalate(t.id)}
                            title="Escalate ticket to relevant Manager"
                          >
                            <CircleAlert size={13} style={{ marginRight: '4px', display: 'inline' }} />
                            Escalate
                          </button>
                        )}
                        <button
                          className="button button-secondary btn-relax"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          onClick={() => onRelax(t.id)}
                          title="Grant +24 hours extension while preserving original breach"
                        >
                          <Clock size={13} style={{ marginRight: '4px', display: 'inline' }} />
                          Give 1-Day Relaxation
                        </button>
                        <button
                          className="button button-secondary"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                          onClick={() => navigate(`/tickets/${t.id}`)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// User Management Page (As requested for Process Analyst)
export function UserManagementPage({ users, onAddUser, onDeleteUser, onEditUser, onSwitchUser, role, currentUser }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('marketing_tl');
  const [department, setDepartment] = useState('Marketing & Lead Gen');
  const [managerId, setManagerId] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Security Controls state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');
  const [resetConfirmUser, setResetConfirmUser] = useState(null);
  const [resettingDevice, setResettingDevice] = useState(false);

  const handleLoginAsUser = (targetUser) => {
    const targetRole =
      roles.find((r) => r.id === targetUser.role) ||
      roles.find((r) => r.name.toLowerCase() === (targetUser.roleName || '').toLowerCase()) ||
      roles[0];
    if (onSwitchUser) {
      onSwitchUser(targetUser, targetRole);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    const logs = await securityApi.getAuditLogs();
    setAuditLogs(logs);
    setLoadingAudit(false);
  };

  const handleToggleWeekendAccess = async (targetUser) => {
    const newState = !targetUser.weekendAccess;
    const res = await securityApi.toggleWeekendAccess({
      targetUserId: targetUser.id,
      weekendAccess: newState,
      performedBy: { name: currentUser || 'Process Analyst', role: role?.id || 'process_analyst' },
      reason: newState ? 'Authorized weekend access granted' : 'Weekend access revoked',
    });
    if (res && res.user) {
      onEditUser(res.user);
    } else {
      onEditUser({ ...targetUser, weekendAccess: newState });
    }
    setSecurityNotice(`Weekend access ${newState ? 'granted' : 'revoked'} for ${targetUser.name}.`);
    setTimeout(() => setSecurityNotice(''), 4000);
  };

  const handleResetDevice = (targetUser) => {
    setResetConfirmUser(targetUser);
  };

  const handleConfirmResetDevice = async () => {
    if (!resetConfirmUser) return;
    setResettingDevice(true);
    const targetUser = resetConfirmUser;
    try {
      const res = await securityApi.resetDevice({
        targetUserId: targetUser.id,
        performedBy: { name: currentUser || 'Process Analyst', role: role?.id || 'process_analyst' },
        reason: 'Process Analyst reset trusted device binding',
      });
      if (res && res.user) {
        onEditUser(res.user);
      } else {
        onEditUser({ ...targetUser, trustedDeviceId: '', trustedDeviceName: '', deviceStatus: 'ACTIVE' });
      }
      setSecurityNotice(`Device enrollment reset for ${targetUser.name}.`);
      setTimeout(() => setSecurityNotice(''), 4000);
      setResetConfirmUser(null);
    } catch (err) {
      console.error('Failed to reset device binding:', err);
    } finally {
      setResettingDevice(false);
    }
  };

  // Edit state
  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState('marketing_tl');
  const [editDepartment, setEditDepartment] = useState('Marketing & Lead Gen');
  const [editManagerId, setEditManagerId] = useState('');
  const [editManagerName, setEditManagerName] = useState('');
  const [editManagerEmail, setEditManagerEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPwd, setShowEditPwd] = useState(false);

  // Delete confirm state
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // View state
  const [viewUser, setViewUser] = useState(null);
  const [showViewPwd, setShowViewPwd] = useState(false);

  const openEdit = (u) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRoleId(u.role);
    setEditDepartment(u.department);
    const isMkt = u.role === 'marketing_tl';
    setEditManagerId(isMkt ? (u.managerId || '') : '');
    setEditManagerName(isMkt ? (u.manager || '') : '');
    setEditManagerEmail(isMkt ? (u.managerEmail || '') : '');
    setEditPassword('');
    setShowEditPwd(false);
  };

  const handleEditRoleChange = (e) => {
    const val = e.target.value;
    setEditRoleId(val);
    if (val === 'marketing_tl') {
      setEditDepartment('Marketing & Lead Gen');
    } else {
      setEditManagerId('');
      setEditManagerName('');
      setEditManagerEmail('');
      if (val === 'sales_tl') setEditDepartment('Sales & Placement');
      else if (val === 'process_analyst') setEditDepartment('Quality & Operations');
      else setEditDepartment('Executive Leadership');
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editName || !editEmail) return;
    const roleObj = roles.find((r) => r.id === editRoleId) || roles[1];
    const isMkt = editRoleId === 'marketing_tl';
    const updated = {
      ...editUser,
      name: editName,
      email: editEmail,
      role: editRoleId,
      roleName: roleObj.name,
      department: editDepartment,
      manager: isMkt ? editManagerName : '',
      managerId: isMkt ? editManagerId : '',
      managerEmail: isMkt ? editManagerEmail : '',
      ...(editPassword ? { password: editPassword } : {}),
    };
    onEditUser && onEditUser(updated);
    setEditUser(null);
  };

  const handleRoleChange = (e) => {
    const val = e.target.value;
    setRoleId(val);
    if (val === 'marketing_tl') {
      setDepartment('Marketing & Lead Gen');
    } else {
      setManagerId('');
      setManagerName('');
      setManagerEmail('');
      if (val === 'sales_tl') setDepartment('Sales & Placement');
      else if (val === 'process_analyst') setDepartment('Quality & Operations');
      else setDepartment('Executive Leadership');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !email) return;

    const roleObj = roles.find((r) => r.id === roleId) || roles[1];
    const isMkt = roleId === 'marketing_tl';
    const newUser = {
      id: `USR-${100 + users.length + 1}`,
      name,
      email,
      role: roleId,
      roleName: roleObj.name,
      department,
      manager: isMkt ? managerName : '',
      managerId: isMkt ? managerId : '',
      managerEmail: isMkt ? managerEmail : '',
      status: 'Active',
      ticketsCount: 0,
      createdAt: 'Today',
      password: newPassword || 'password123',
    };

    onAddUser(newUser);
    setShowAddModal(false);
    setName('');
    setEmail('');
    setManagerId('');
    setManagerName('');
    setManagerEmail('');
    setNewPassword('');
  };

  const marketingCount = users.filter((u) => u.role === 'marketing_tl').length;
  const salesCount = users.filter((u) => u.role === 'sales_tl').length;
  const paCount = users.filter((u) => u.role === 'process_analyst').length;
  const mgrCount = users.filter((u) => u.role === 'manager').length;

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="QUALITY & OPERATIONS / USER DIRECTORY"
        title="User Management"
        subtitle="Manage authorized Team Leads and operations personnel across Marketing, Sales, and Leadership."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                loadAuditLogs();
                setShowAuditModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            >
              <ShieldAlert size={15} color="#475569" />
              Security Logs
            </button>
            <Button
              icon={UserPlus}
              onClick={() => setShowAddModal(true)}
            >
              Create Team Lead / User
            </Button>
          </div>
        }
      />

      {securityNotice && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1d4ed8',
          padding: '10px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <CheckCircle2 size={16} />
          {securityNotice}
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon tone-blue">
            <Users size={18} />
          </div>
          <div className="metric-label">Total Users</div>
          <strong>{users.length}</strong>
          <span className="metric-hint">Active personnel</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-blue">
            <UserRound size={18} />
          </div>
          <div className="metric-label">Marketing TLs</div>
          <strong>{marketingCount}</strong>
          <span className="metric-hint">Structured Ticket Creators</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-teal">
            <UserRound size={18} />
          </div>
          <div className="metric-label">Sales TLs</div>
          <strong>{salesCount}</strong>
          <span className="metric-hint">Custom Ticket Creators</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-amber">
            <ShieldCheck size={18} />
          </div>
          <div className="metric-label">Process Analysts</div>
          <strong>{paCount}</strong>
          <span className="metric-hint">Assignment Authorities</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon tone-indigo">
            <Zap size={18} />
          </div>
          <div className="metric-label">Managers</div>
          <strong>{mgrCount}</strong>
          <span className="metric-hint">Escalation Governance</span>
        </div>
      </div>

      <section className="section-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ACTIVE DIRECTORY</p>
            <h2>Authorized Users & Roles</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Weekend Access</th>
                <th>Trusted Device</th>
                <th>Status</th>
                <th>Date Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar name={u.name} small />
                      <div>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-pill ${u.role}`}>{u.roleName || u.role}</span>
                  </td>
                  <td>{u.department}</td>
                  <td>
                    <button
                      type="button"
                      title={u.weekendAccess ? "Authorized: Click to Revoke Weekend Access" : "Restricted: Click to Grant Weekend Access"}
                      onClick={() => handleToggleWeekendAccess(u)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: u.weekendAccess ? '1px solid #86efac' : '1px solid #e2e8f0',
                        background: u.weekendAccess ? '#f0fdf4' : '#f8fafc',
                        color: u.weekendAccess ? '#15803d' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: u.weekendAccess ? '#22c55e' : '#94a3b8',
                      }} />
                      {u.weekendAccess ? 'Authorized' : 'Restricted'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        color: u.trustedDeviceId ? '#0f172a' : '#94a3b8',
                        fontWeight: u.trustedDeviceId ? 600 : 400,
                      }}>
                        {u.trustedDeviceName || (u.trustedDeviceId ? 'Enrolled' : 'Not Enrolled')}
                      </span>
                      {u.trustedDeviceId && (
                        <button
                          type="button"
                          title="Reset Device Binding (Allows user to bind a new machine on next login)"
                          onClick={() => handleResetDevice(u)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            color: '#475569',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                        >
                          <RotateCcw size={11} />
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge type="status">{u.status || 'Active'}</Badge>
                  </td>
                  <td>
                    <small>{u.createdAt || '10 Jan 2026'}</small>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {/* View Button */}
                      <button
                        title="View User Details"
                        style={{
                          color: '#0891b2',
                          background: '#ecfeff',
                          border: '1px solid #a5f3fc',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#cffafe'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#ecfeff'; }}
                        onClick={() => { setViewUser(u); setShowViewPwd(false); }}
                      >
                        <Eye size={14} />
                      </button>
                      {/* Login As User (Process Team Access) */}
                      <button
                        title={`Login As ${u.name} (Process Team Access)`}
                        style={{
                          color: '#059669',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#d1fae5'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#ecfdf5'; }}
                        onClick={() => handleLoginAsUser(u)}
                      >
                        <KeyRound size={14} />
                      </button>
                      {/* Edit Button */}
                      <button
                        title="Edit User"
                        style={{
                          color: '#2563eb',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                        onClick={() => openEdit(u)}
                      >
                        <Pencil size={14} />
                      </button>
                      {/* Delete Button */}
                      <button
                        title="Delete User from Database"
                        style={{
                          color: '#dc2626',
                          background: '#fef2f2',
                          border: '1px solid #fee2e2',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                        onClick={() => setDeleteConfirmUser(u)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── View User Modal ── */}
      {viewUser && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setViewUser(null)}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '440px',
              border: 'none',
              borderTop: '4px solid #0891b2',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
              padding: '32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0891b2, #0e7490)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '18px',
                  flexShrink: 0,
                }}>
                  {viewUser.name ? viewUser.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>{viewUser.name}</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{viewUser.email}</p>
                </div>
              </div>
              <button className="icon-button" onClick={() => setViewUser(null)}><X size={18} /></button>
            </div>

            {/* Detail rows */}
            {[
              { label: 'User ID', value: viewUser.id, mono: true },
              { label: 'Role', value: viewUser.roleName || viewUser.role },
              { label: 'Department', value: viewUser.department },
              ...(viewUser.role === 'marketing_tl' && viewUser.manager
                ? [{ label: 'Reporting Manager', value: `${viewUser.manager} (${viewUser.managerEmail || ''})` }]
                : []),
              { label: 'Weekend Access', value: viewUser.weekendAccess ? 'Authorized (Active)' : 'Restricted (Default)' },
              { label: 'Trusted Device', value: viewUser.trustedDeviceName || (viewUser.trustedDeviceId ? 'Enrolled Machine' : 'Not Enrolled') },
              { label: 'Status', value: viewUser.status || 'Active' },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
              </div>
            ))}

            {/* Password row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', letterSpacing: showViewPwd ? '0.05em' : '0.15em' }}>
                  {showViewPwd ? (viewUser.password || 'password123') : '••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowViewPwd(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex', alignItems: 'center' }}
                  title={showViewPwd ? 'Hide' : 'Reveal password'}
                >
                  <Eye size={15} style={{ opacity: showViewPwd ? 1 : 0.4 }} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={() => setViewUser(null)}
                style={{
                  padding: '10px 32px', borderRadius: '8px',
                  border: 'none', background: 'linear-gradient(135deg, #0891b2, #0e7490)',
                  color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(8,145,178,0.3)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmUser && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog" style={{
            maxWidth: '420px',
            textAlign: 'center',
            padding: '36px 32px',
            border: 'none',
            borderTop: '4px solid #dc2626',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
          }}>
            <div style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Trash2 size={26} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Delete User
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '6px' }}>
              You are about to permanently delete
            </p>
            <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px', marginBottom: '6px' }}>
              {deleteConfirmUser.name}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '28px' }}>
              {deleteConfirmUser.roleName} · {deleteConfirmUser.department}
            </p>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '28px',
              fontSize: '13px',
              color: '#b91c1c',
            }}>
              ⚠️ This will permanently remove this user from the database. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteUser && onDeleteUser(deleteConfirmUser.id);
                  setDeleteConfirmUser(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
                }}
              >
                Yes, I Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit User Modal ── */}
      {editUser && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog" style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
          }}>
            <div className="modal-header">
              <div>
                <h3>Edit Team Member</h3>
                <p>Update name, email, role, or department for <strong>{editUser.name}</strong>.</p>
              </div>
              <button className="icon-button" onClick={() => setEditUser(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-grid" style={{ marginBottom: '18px' }}>
                <label className="span-2" style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Full Name
                  <input
                    required
                    placeholder="Full name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', width: '100%', boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                  />
                </label>
                <label className="span-2" style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Work Email Address
                  <input
                    type="email"
                    required
                    placeholder="email@netbounce.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', width: '100%', boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                  />
                </label>
                <label style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User ID
                  <input
                    value={editUser.id}
                    readOnly
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#94a3b8', width: '100%', cursor: 'not-allowed', boxShadow: 'none' }}
                  />
                </label>
                <label style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Assign Role
                  <select
                    value={editRoleId}
                    onChange={handleEditRoleChange}
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0f172a', width: '100%', cursor: 'pointer', boxShadow: 'none', appearance: 'auto' }}
                    onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                  >
                    <option value="marketing_tl">Marketing TL</option>
                    <option value="sales_tl">Sales TL</option>
                    <option value="process_analyst">Process Analyst</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
                <label className="span-2" style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Department / Team
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0f172a', width: '100%', cursor: 'pointer', boxShadow: 'none', appearance: 'auto' }}
                    onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                    onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                  >
                    <option value="Marketing & Lead Gen">Marketing &amp; Lead Gen</option>
                    <option value="Sales & Placement">Sales &amp; Placement</option>
                    <option value="Quality & Operations">Quality &amp; Operations</option>
                    <option value="Executive Leadership">Executive Leadership</option>
                  </select>
                </label>
                {editRoleId === 'marketing_tl' && (
                  <label className="span-2" style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Reporting Manager
                    <select
                      value={editManagerId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditManagerId(val);
                        const mgr = users.find((u) => u.id === val);
                        setEditManagerName(mgr ? mgr.name : '');
                        setEditManagerEmail(mgr ? mgr.email : '');
                      }}
                      style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0f172a', width: '100%', cursor: 'pointer', boxShadow: 'none', appearance: 'auto' }}
                      onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                      onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                    >
                      <option value="">-- No Manager Assigned --</option>
                      {users.filter((u) => u.role === 'manager').map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="span-2" style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  New Password <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', fontSize: '11px' }}>(leave blank to keep current)</span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditPwd ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #e2e8f0', borderRadius: 0, padding: '8px 2px', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#0f172a', width: '100%', boxShadow: 'none', paddingRight: '32px' }}
                      onFocus={(e) => { e.target.style.borderBottomColor = '#2563eb'; }}
                      onBlur={(e) => { e.target.style.borderBottomColor = '#e2e8f0'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPwd(v => !v)}
                      style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title={showEditPwd ? 'Hide password' : 'Show password'}
                    >
                      {showEditPwd ? <Eye size={16} /> : <Eye size={16} style={{ opacity: 0.4 }} />}
                    </button>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button type="button" variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
                <Button type="submit" icon={Pencil}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add User Modal */}
      {showAddModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog" style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
          }}>
            <div className="modal-header">
              <div>
                <h3>Create New Team Member</h3>
                <p>Add a new Sales TL, Marketing TL, Process Analyst, or Manager.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid" style={{ marginBottom: '18px' }}>
                <label className="span-2">
                  Full Name
                  <input
                    required
                    placeholder="e.g. Vikramaditya Rathore"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="span-2">
                  Work Email Address
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram.rathore@netbounce.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Assign Role
                  <select value={roleId} onChange={handleRoleChange}>
                    <option value="marketing_tl">Marketing TL</option>
                    <option value="sales_tl">Sales TL</option>
                    <option value="process_analyst">Process Analyst</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
                <label>
                  Department / Team
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="Marketing & Lead Gen">Marketing & Lead Gen</option>
                    <option value="Sales & Placement">Sales & Placement</option>
                    <option value="Quality & Operations">Quality & Operations</option>
                    <option value="Executive Leadership">Executive Leadership</option>
                  </select>
                </label>
                {roleId === 'marketing_tl' && (
                  <label className="span-2">
                    Reporting Manager
                    <select
                      value={managerId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManagerId(val);
                        const mgr = users.find((u) => u.id === val);
                        setManagerName(mgr ? mgr.name : '');
                        setManagerEmail(mgr ? mgr.email : '');
                      }}
                    >
                      <option value="">-- No Manager Assigned --</option>
                      {users.filter((u) => u.role === 'manager').map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="span-2">
                  Set Password
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      placeholder="Default: password123"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingRight: '36px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(v => !v)}
                      style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title={showNewPwd ? 'Hide password' : 'Show password'}
                    >
                      {showNewPwd ? <Eye size={16} /> : <Eye size={16} style={{ opacity: 0.4 }} />}
                    </button>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  icon={UserPlus}
                >
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Security Audit Logs Modal ── */}
      {showAuditModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowAuditModal(false)}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '720px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              border: 'none',
              borderTop: '4px solid #0f172a',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
              padding: '32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Security Audit Logs
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Permanent audit record of access grants, device resets, and security gate events.
                </p>
              </div>
              <button className="icon-button" onClick={() => setShowAuditModal(false)}><X size={18} /></button>
            </div>

            {loadingAudit ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Loading security audit history...
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                No security events recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id || log._id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: log.eventType?.includes('GRANTED') ? '#dcfce7' : (log.eventType?.includes('DENIED') ? '#fee2e2' : '#e0e7ff'),
                          color: log.eventType?.includes('GRANTED') ? '#15803d' : (log.eventType?.includes('DENIED') ? '#b91c1c' : '#3730a3'),
                        }}>
                          {log.eventType?.replace(/_/g, ' ')}
                        </span>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                          {log.userName || log.userId}
                        </strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {log.reason || 'Security gate event'} &bull; By: {log.performedBy?.name || 'System'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button
                onClick={() => setShowAuditModal(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Reset Device Binding Premium Floating Modal ── */}
      {resetConfirmUser && createPortal(
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => !resettingDevice && setResetConfirmUser(null)}
        >
          <div
            className="modal-dialog"
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9)',
              padding: '30px 28px 26px',
              borderTop: '4px solid #f59e0b',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => !resettingDevice && setResetConfirmUser(null)}
              disabled={resettingDevice}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: resettingDevice ? 'not-allowed' : 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={16} />
            </button>

            {/* Glowing Icon Badge */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              marginBottom: '18px',
              boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.25)',
            }}>
              <RotateCcw size={26} style={{ strokeWidth: 2.2 }} />
            </div>

            {/* Title & Description */}
            <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>
              Reset Trusted Device Binding
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to reset the machine binding for this user?
            </p>

            {/* Employee & Machine Details Card */}
            <div style={{
              margin: '18px 0',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Employee:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{resetConfirmUser.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Email:</span>
                <span style={{ color: '#334155', fontWeight: 500 }}>{resetConfirmUser.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Currently Bound Device:</span>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {resetConfirmUser.trustedDeviceName || 'Registered Machine'}
                </span>
              </div>
            </div>

            {/* Explanatory Info Box */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '22px',
            }}>
              <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '12px', color: '#166534', lineHeight: 1.45 }}>
                Resetting allows <strong>{resetConfirmUser.name}</strong> to enroll a new machine or laptop upon their next login attempt.
              </span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => !resettingDevice && setResetConfirmUser(null)}
                disabled={resettingDevice}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: resettingDevice ? 'not-allowed' : 'pointer',
                  opacity: resettingDevice ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDevice}
                disabled={resettingDevice}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: resettingDevice ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: resettingDevice ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {resettingDevice ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Resetting Device...
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    Confirm Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Create Ticket Component - strictly adhering to Section 4 (Marketing) vs Section 8 (Sales)
export function CreateTicket({ role, currentUser, onCreateTicket }) {
  const navigate = useNavigate();

  // 'sales' = Structured 10-topic selection (Sales TL)
  // 'marketing' = Custom free-text issue input (Marketing TL)
  const [formType, setFormType] = useState(() => (role.id === 'marketing_tl' ? 'marketing' : 'sales'));

  // Immediately synchronize form view when role changes (e.g., from top bar switcher)
  useEffect(() => {
    setFormType(role.id === 'marketing_tl' ? 'marketing' : 'sales');
  }, [role.id]);

  // Candidate Information
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');

  // Marketing specific fields: MUST BE CUSTOM TEXT INPUTS
  const [seniorRecruiter, setSeniorRecruiter] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [customIssueTitle, setCustomIssueTitle] = useState('');

  // Sales specific fields: POC, Sr. Name
  const [salesRep, setSalesRep] = useState('');
  const [salesPoc, setSalesPoc] = useState('');
  const [salesSenior, setSalesSenior] = useState('');
  const [marketingTlEmail, setMarketingTlEmail] = useState('');

  // Marketing TL list from DB (for Recruiter dropdown in Sales form)
  const [marketingTLs, setMarketingTLs] = useState([]);
  useEffect(() => {
    userApi.list().then((all) => {
      setMarketingTLs(all.filter((u) => u.role === 'marketing_tl'));
    }).catch(() => {});
  }, []);

  // When a Marketing TL is selected, auto-fill their email ID in the Marketing TL Mail ID box
  const handleRecruiterSelect = (e) => {
    const selectedName = e.target.value;
    setRecruiter(selectedName);
    if (selectedName) {
      const tl = marketingTLs.find((u) => u.name === selectedName);
      const email = tl?.email || '';
      setMarketingTlEmail(email);
      setSalesPoc(email);
    } else {
      setMarketingTlEmail('');
      setSalesPoc('');
    }
  };

  // Priority dropdown
  const [priority, setPriority] = useState('High');

  // Sales 2-Level topic selection (10 topics)
  const topicKeys = Object.keys(marketingTopics);
  const [mainTopic, setMainTopic] = useState(topicKeys[0]);
  const [subTopic, setSubTopic] = useState(marketingTopics[topicKeys[0]][0]);

  // Description & Attachments
  const [description, setDescription] = useState('');
  // attachedFiles: array of { name, type, size, dataUrl }
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [created, setCreated] = useState(false);
  const fileInputRef = useRef(null);

  // When mainTopic changes, update subtopic
  const handleMainTopicChange = (newTopic) => {
    setMainTopic(newTopic);
    const subList = marketingTopics[newTopic] || [];
    setSubTopic(subList[0] || '');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedFiles((prev) => [
          ...prev,
          { name: file.name, type: file.type, size: file.size, dataUrl: ev.target.result },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so same file can be re-added
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const isSales = formType === 'sales';
    const newTicketPayload = {
      title: isSales ? mainTopic : customIssueTitle,
      candidate: candidateName,
      email: candidateEmail,
      phone: candidatePhone,
      team: isSales ? 'Sales' : 'Marketing',
      targetTeam: isSales ? 'Marketing' : 'Sales',
      subTeam: isSales ? 'Placement Ops' : 'Inbound Marketing',
      creatorRole: isSales ? 'sales_tl' : 'marketing_tl',
      createdBy: currentUser,
      priority,
      category: isSales ? mainTopic : 'Custom Marketing Issue',
      subCategory: isSales ? subTopic : customIssueTitle,
      seniorRecruiter: isSales ? seniorRecruiter : '',
      recruiter: isSales ? recruiter : '',
      assignee: isSales ? (recruiter || 'Unassigned') : 'Unassigned',
      assigneeRole: isSales && recruiter ? 'marketing_tl' : '',
      salesRep: isSales ? salesRep : '',
      salesPoc: isSales ? (marketingTlEmail || salesPoc) : '',
      marketingTlEmail: isSales ? (marketingTlEmail || salesPoc) : '',
      salesSenior: '',
      description,
      attachments: attachedFiles,
    };

    setCreated(true);
    onCreateTicket(newTicketPayload);

    setTimeout(() => {
      navigate('/tickets');
    }, 700);
  };

  return (
    <div className="page page-enter narrow-page">
      <PageHeader
        eyebrow="WORKSPACE / NEW TICKET"
        title={formType === 'sales' ? 'Create Sales Ticket' : 'Create Marketing Ticket'}
        subtitle={
          formType === 'sales'
            ? 'Structured issue selection for Sales operations using 10 placement topics.'
            : 'Custom issue report for Marketing operations and cross-team support.'
        }
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            {role.id === 'process_analyst' && (
              <Button
                variant="secondary"
                onClick={() => setFormType(formType === 'sales' ? 'marketing' : 'sales')}
              >
                Switch to {formType === 'sales' ? 'Marketing Form' : 'Sales Form'}
              </Button>
            )}
            <Button
              data-testid="create-cancel-button"
              variant="ghost"
              onClick={() => navigate('/tickets')}
            >
              Cancel
            </Button>
          </div>
        }
      />

      <form className="ticket-form" onSubmit={handleSubmit}>
        {/* Candidate Information */}
        <div className="form-section">
          <div className="form-section-heading">
            <span className="section-number">01</span>
            <div>
              <h2>Candidate Information</h2>
              <p>Primary candidate context required for all placement tickets.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Candidate Name <span style={{ color: 'var(--red)' }}>*</span></span>
              <input
                data-testid="ticket-candidate-name-input"
                required
                placeholder="e.g. Rahul Sharma"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
              />
            </label>
            <label>
              <span>Candidate Email ID <span style={{ color: 'var(--red)' }}>*</span></span>
              <input
                data-testid="ticket-candidate-email-input"
                type="email"
                required
                placeholder="candidate@email.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
              />
            </label>
            <label className="span-2">
              <span>Candidate Phone Number <span style={{ color: 'var(--red)' }}>*</span></span>
              <input
                data-testid="ticket-candidate-phone-input"
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={candidatePhone}
                onChange={(e) => setCandidatePhone(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Recruiter & Sales Points of Contact (Exclusively for Sales TL) */}
        {formType === 'sales' && (
          <div className="form-section">
            <div className="form-section-heading">
              <span className="section-number">02</span>
              <div>
                <h2>Recruiter & Placement Team Context</h2>
                <p>Assigned recruiter details, Marketing TL & Representative information.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>Senior Recruiter</span>
                <input
                  placeholder="Enter Senior Recruiter name (optional)"
                  value={seniorRecruiter}
                  onChange={(e) => setSeniorRecruiter(e.target.value)}
                />
              </label>
              <label>
                <span>Marketing TL <span style={{ color: 'var(--red)' }}>*</span></span>
                <select
                  required
                  value={recruiter}
                  onChange={handleRecruiterSelect}
                >
                  <option value="">— Select Marketing TL —</option>
                  {marketingTLs.map((tl) => (
                    <option key={tl.id} value={tl.name}>{tl.name}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                <span>Marketing TL Mail ID</span>
                <input
                  readOnly
                  placeholder="Auto-filled from Marketing TL"
                  value={marketingTlEmail || salesPoc}
                  style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#475569' }}
                />
              </label>
            </div>
          </div>
        )}

        {/* Issue Details */}
        <div className="form-section">
          <div className="form-section-heading">
            <span className="section-number">{formType === 'sales' ? '03' : '02'}</span>
            <div>
              <h2>{formType === 'sales' ? 'Structured Issue Selection' : 'Custom Issue & Concern'}</h2>
              <p>
                {formType === 'sales'
                  ? 'Two-level topic selection for Sales placements using the 10 standard issue categories.'
                  : 'Marketing TL enters a custom issue title for this concern.'}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label className="span-2">
              <span>Priority</span>
              <select
                data-testid="ticket-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>

            {formType === 'sales' ? (
              <>
                <label className="span-2">
                  <span>Select Main Topic <span style={{ color: 'var(--red)' }}>*</span></span>
                  <select
                    value={mainTopic}
                    onChange={(e) => handleMainTopicChange(e.target.value)}
                  >
                    {topicKeys.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="span-2">
                  <span>Select Subtopic <span style={{ color: 'var(--red)' }}>*</span></span>
                  <select
                    value={subTopic}
                    onChange={(e) => setSubTopic(e.target.value)}
                  >
                    {(marketingTopics[mainTopic] || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Description appears AFTER subtopic is chosen */}
                {subTopic && (
                  <label className="span-2">
                    <span>Description <span style={{ color: 'var(--red)' }}>*</span></span>
                    <textarea
                      required
                      placeholder="Add full background and specific details regarding this grievance..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="span-2">
                  <span>Custom Issue / Concern Title <span style={{ color: 'var(--red)' }}>*</span></span>
                  <input
                    required
                    placeholder="Enter custom issue (e.g. Candidate not receiving interview updates)"
                    value={customIssueTitle}
                    onChange={(e) => setCustomIssueTitle(e.target.value)}
                  />
                </label>
                <label className="span-2">
                  <span>Description <span style={{ color: 'var(--red)' }}>*</span></span>
                  <textarea
                    required
                    placeholder="Provide full description of the marketing operational or cross-team issue..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Attachment / Photo Upload */}
        <div className="form-section">
          <div className="form-section-heading">
            <span className="section-number">{formType === 'sales' ? '04' : '03'}</span>
            <div>
              <h2>Attachments & Photos <small>Optional</small></h2>
              <p>Upload screenshots, PDFs, Excel sheets, audio logs, or identity documents.</p>
            </div>
          </div>

          {/* Drop zone */}
          <label
            className="dropzone"
            data-testid="ticket-attachment-dropzone"
            style={{ cursor: 'pointer' }}
          >
            <Paperclip size={22} />
            <strong>Drop files here or click to browse</strong>
            <span>PNG, JPG, PDF, XLSX, DOCX, MP3, MP4 · Up to 25MB each · Multiple allowed</span>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept=".png,.jpg,.jpeg,.pdf,.xlsx,.xls,.docx,.doc,.mp3,.mp4,.wav,.txt,.csv,.eml"
              onChange={handleFileChange}
            />
          </label>

          {/* Attached files list */}
          {attachedFiles.length > 0 && (
            <div className="attached-files-list">
              {attachedFiles.map((file, idx) => {
                const isImage = file.type.startsWith('image/');
                const isPdf = file.type === 'application/pdf';
                const isExcel = file.type.includes('spreadsheet') || file.name.match(/\.(xlsx|xls|csv)$/i);
                return (
                  <div key={idx} className="attached-file-row">
                    <span className="attached-file-icon">
                      {isImage ? <Image size={16} /> : isExcel ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                    </span>
                    <span className="attached-file-name" title={file.name}>{file.name}</span>
                    <span className="attached-file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      className="attached-file-remove"
                      onClick={() => removeFile(idx)}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="info-callout">
          <InfoIcon size={17} />
          <div>
            <strong>Process Analyst Assignment & 24h SLA Notice</strong>
            <p>
              When submitted, this ticket receives status <strong>NEW (Pending Assignment)</strong>.
              The 24-hour SLA does <em>not</em> start now. It starts only when the Process Analyst assigns the ticket to a Team Lead.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <Button
            type="submit"
            icon={created ? ShieldCheck : Plus}
            disabled={created}
          >
            {created ? 'Ticket Submitted to PA' : formType === 'sales' ? 'Create Sales Ticket' : 'Create Marketing Ticket'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Message({ name, role, time, text, mine, isSystem, viaEmail, deliveryStatus }) {
  return (
    <div className={`message ${mine ? 'message-mine' : ''} ${isSystem ? 'message-system' : ''}`}>
      <Avatar name={name} small />
      <div className="message-content">
        <div>
          <strong>{name}</strong>
          <span>{role} · {time}</span>
          {viaEmail && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#60a5fa', opacity: 0.9, fontWeight: 500 }}>
              ✉ Sent via email
            </span>
          )}
          {deliveryStatus === 'failed' && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
              ⚠ Email delivery failed
            </span>
          )}
        </div>
        <p>{text}</p>
      </div>
    </div>
  );
}

export function Info({ title, children }) {
  return (
    <div className="info-card">
      <div className="info-card-title">
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// Ticket Detail with PA Assignment, 24h SLA Countdown, Breach Actions, Continuous Thread, and Timeline
export function TicketDetail({ role, currentUser, tickets, onAssign, onEscalate, onRelax, onResolve, onReopen, onAddReply }) {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const ticket = tickets.find((t) => t.id === ticketId);
  const [replyText, setReplyText] = useState('');
  const [selectedTL, setSelectedTL] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const isPA = role.id === 'process_analyst';
  const isAssigned = Boolean(ticket && ticket.assignee && ticket.assignee !== 'Unassigned' && String(ticket.assignee).trim() !== '');

  const usersList = getStoredUsers();
  const availableTLs = usersList.filter(
    (u) => u.role === 'marketing_tl' || u.role === 'sales_tl'
  );

  if (!ticket) {
    return (
      <div className="page page-enter" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <CircleAlert size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
        <h2>Ticket Not Found</h2>
        <p style={{ color: '#64748b', maxWidth: '460px', margin: '8px auto 24px' }}>
          The requested ticket does not exist or has been removed.
        </p>
        <Button onClick={() => navigate('/tickets')}>Return to Tickets</Button>
      </div>
    );
  }

  // Authorization check - prevent unauthorized TLs from viewing tickets
  const canAccess = isTicketForRole(ticket, role, currentUser, usersList);
  if (!canAccess) {
    return (
      <div className="page page-enter" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2>Access Restricted</h2>
        <p style={{ color: '#64748b', maxWidth: '460px', margin: '8px auto 24px' }}>
          You are not authorized to view this ticket. Direct access is restricted to ticket participants (Creator, Assignee, Process Analyst, or Reporting Manager).
        </p>
        <Button onClick={() => navigate('/tickets')}>Return to My Tickets</Button>
      </div>
    );
  }

  // 7-day reopen window calculation for Closed tickets
  const isClosed = ticket.status === 'Closed';
  const closedTime = ticket.closedAt ? new Date(ticket.closedAt).getTime() : null;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isReopenExpired = isClosed && closedTime && (Date.now() - closedTime > SEVEN_DAYS_MS);

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!selectedTL) return;
    const targetUser = availableTLs.find((u) => u.name === selectedTL) || {
      name: selectedTL,
      role: 'marketing_tl',
    };
    onAssign(ticket.id, targetUser, currentUser);
  };

  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onAddReply(ticket.id, currentUser, role.name, replyText);
    setReplyText('');
  };

  const handleConfirmReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim() || isReopenExpired) return;
    try {
      await onReopen(ticket.id, currentUser, role.name, reopenReason.trim());
      setShowReopenModal(false);
      setReopenReason('');
    } catch (err) {
      alert(err.message || 'Unable to reopen ticket.');
    }
  };

  return (
    <div className="page page-enter">
      <div className="detail-top">
        <div>
          <button
            data-testid="ticket-back-button"
            className="back-link"
            onClick={() => navigate('/tickets')}
          >
            <ChevronLeft size={15} /> Back to tickets
          </button>
          <div className="ticket-title-line">
            <span className="ticket-id-large">{ticket.id}</span>
            <Badge type={ticket.status ? ticket.status.toLowerCase().replaceAll(' ', '-') : 'open'}>
              {ticket.status}
            </Badge>
            <Badge type={ticket.priority ? ticket.priority.toLowerCase() : 'high'}>
              {ticket.priority} priority
            </Badge>
            {ticket.isRelaxed && (
              <Badge type="relaxed">
                +1 Day Relaxation Active
              </Badge>
            )}
            {ticket.reopenedAt && ticket.status !== 'Resolved' && (
              <Badge type="escalation" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                Reopened
              </Badge>
            )}
          </div>
          <h1>{ticket.title}</h1>
          <p className="page-subtitle">
            Raised by {ticket.createdBy} ({ticket.team}) · {ticket.createdAt}
          </p>
        </div>

        <div className="detail-actions">
          {/* PA Breach Actions */}
          {isPA && (ticket.slaState === 'breached' || ticket.status === 'Escalated') && (
            <>
              {ticket.status !== 'Escalated' && (
                <Button
                  variant="secondary"
                  className="btn-escalate"
                  icon={CircleAlert}
                  onClick={() => onEscalate(ticket.id)}
                >
                  Escalate to Manager
                </Button>
              )}
              <Button
                variant="secondary"
                className="btn-relax"
                icon={Clock}
                onClick={() => onRelax(ticket.id)}
              >
                Give 1-Day Relaxation
              </Button>
            </>
          )}

          {/* Resolve Ticket Button */}
          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
            <Button
              icon={ShieldCheck}
              onClick={() => onResolve(ticket.id, currentUser, role.name)}
            >
              Resolve Ticket
            </Button>
          )}

          {/* Reopen Ticket Button (Sales TL, Marketing TL, and Process Analyst) with 7-day enforcement */}
          {(ticket.status === 'Resolved' || ticket.status === 'Closed') && (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <Button
                variant="secondary"
                icon={RotateCcw}
                disabled={isReopenExpired}
                title={isReopenExpired ? 'Reopen window expired. Tickets can only be reopened within 7 days of closure.' : 'Reopen Ticket'}
                style={
                  isReopenExpired
                    ? {
                        borderColor: '#e2e8f0',
                        color: '#94a3b8',
                        background: '#f8fafc',
                        cursor: 'not-allowed',
                        opacity: 0.6,
                      }
                    : {
                        borderColor: '#f59e0b',
                        color: '#b45309',
                        background: '#fffbeb',
                        fontWeight: 600,
                      }
                }
                onClick={() => {
                  if (isReopenExpired) return;
                  setReopenReason('');
                  setShowReopenModal(true);
                }}
              >
                Reopen Ticket
              </Button>
              {isReopenExpired && (
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', maxWidth: '240px', textAlign: 'right' }}>
                  Reopen window expired. Tickets can only be reopened within 7 days of closure.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reopened Ticket Alert Banner */}
      {ticket.reopenedAt && ticket.status !== 'Resolved' && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#92400e',
          fontSize: '12px',
        }}>
          <RotateCcw size={18} color="#d97706" />
          <div>
            <strong>Ticket Reopened:</strong> Reopened by {ticket.reopenedBy} at {ticket.reopenedAt}.
            <span style={{ display: 'block', fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
              Reason: {ticket.reopenReason || 'Resolution was not satisfactory.'}
            </span>
          </div>
        </div>
      )}

      {/* SLA Breach Banner */}
      {ticket.slaState === 'breached' && (
        <div className="breach-banner" data-testid="sla-breach-banner">
          <div className="breach-icon">
            <CircleAlert size={19} />
          </div>
          <div>
            <strong>SLA Breached · Overdue for Resolution</strong>
            <span>
              This ticket breached its committed 24-hour turnaround target at {ticket.breachedAt || '10:15 AM'}.
              Process Analyst may escalate to Manager or grant a 1-day relaxation.
            </span>
          </div>
        </div>
      )}

      {/* SLA Relaxation Banner */}
      {ticket.isRelaxed && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#166534',
          fontSize: '12px'
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <div>
            <strong>1-Day SLA Relaxation Active:</strong> New resolution deadline extended by +24 hours to {ticket.slaDeadline}.
            <span style={{ display: 'block', fontSize: '10px', color: '#15803d' }}>
              Note: Original breach at {ticket.breachedAt} remains preserved in the audit log.
            </span>
          </div>
        </div>
      )}

      {/* Unassigned Ticket Banner for Process Analyst */}
      {!isAssigned && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <strong style={{ color: '#1e40af', fontSize: '12px' }}>Awaiting Process Analyst Assignment</strong>
            <p style={{ margin: '4px 0 0', color: '#3b82f6', fontSize: '11px' }}>
              The 24-hour resolution SLA has not started. Assignment by the Process Analyst will initiate the 24h timer.
            </p>
          </div>
          {isPA && (
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                required
                value={selectedTL}
                onChange={(e) => setSelectedTL(e.target.value)}
                style={{ height: '36px', fontSize: '12px', padding: '0 10px' }}
              >
                <option value="">Select Responsible TL...</option>
                {availableTLs.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.roleName || u.role})
                  </option>
                ))}
              </select>
              <Button type="submit" icon={Zap} style={{ padding: '8px 14px' }}>
                Assign & Start 24h SLA
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="detail-layout">
        <div className="detail-main">
          {/* Continuous Conversation Panel */}
          <section className="conversation-panel">
            <div className="panel-top">
              <div>
                <p className="eyebrow">CONTINUOUS THREAD</p>
                <h2>
                  Ticket Thread <span>{(ticket.thread || []).length} messages</span>
                </h2>
              </div>
              <Ellipsis size={17} />
            </div>

            <div className="conversation">
              {(ticket.thread || []).map((msg) => (
                <Message
                  key={msg.id}
                  name={msg.name}
                  role={msg.role}
                  time={msg.time}
                  text={msg.text}
                  mine={msg.name === currentUser}
                  isSystem={msg.isSystem}
                  viaEmail={msg.viaEmail}
                  deliveryStatus={msg.deliveryStatus}
                />
              ))}
            </div>

            {/* Reply Composer */}
            <form className="reply-composer" onSubmit={handleReplySubmit}>
              <textarea
                data-testid="ticket-reply-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write an update, question, or reply to this continuous ticket thread…"
              />
              <div>
                <button type="button" data-testid="reply-attach-button" className="icon-button">
                  <Paperclip size={17} />
                </button>
                <span>All communication remains preserved in one thread</span>
                <Button
                  data-testid="reply-send-button"
                  type="submit"
                  disabled={!replyText.trim()}
                  icon={Send}
                >
                  Send Reply
                </Button>
              </div>
            </form>
          </section>

          {/* Activity / Audit Timeline */}
          <section className="activity-panel">
            <div className="panel-top">
              <div>
                <p className="eyebrow">AUDIT RECORD</p>
                <h2>Activity Timeline</h2>
              </div>
            </div>
            <div className="timeline">
              {(ticket.timeline || []).map((evt, idx) => {
                const label = evt.action || evt.title || '';
                return (
                  <div className="timeline-item" key={evt.id || evt._id || idx}>
                    <span className="timeline-icon">
                      {label.includes('Assigned') ? (
                        <Zap size={14} />
                      ) : label.includes('Breached') ? (
                        <AlertTriangle size={14} color="var(--red)" />
                      ) : label.includes('Relaxation') ? (
                        <Clock size={14} color="var(--green)" />
                      ) : label.includes('Escalated') ? (
                        <CircleAlert size={14} color="var(--red)" />
                      ) : label.includes('Resolved') ? (
                        <ShieldCheck size={14} color="var(--green)" />
                      ) : (
                        <Plus size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <span>{evt.detail || ''}</span>
                      {(evt.user || evt.role) && (
                        <small style={{ color: 'var(--muted)', fontSize: '9px' }}>
                          By {evt.user || 'System'} {evt.role ? `(${evt.role})` : ''}
                        </small>
                      )}
                    </div>
                    <time>{evt.time || ''}</time>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar Details */}
        <aside className="detail-sidebar">
          {/* Candidate Card */}
          <Info title="Candidate Information">
            <div className="candidate-head">
              <Avatar name={ticket.candidate} />
              <div>
                <strong>{ticket.candidate}</strong>
                <span>{ticket.email}</span>
                {ticket.phone && (
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {ticket.phone}
                  </small>
                )}
              </div>
            </div>
          </Info>

          {/* Ticket Metadata Card */}
          <Info title="Issue Details">
            <div className="side-data">
              <span>
                Main Topic <strong>{ticket.category}</strong>
              </span>
              {ticket.subCategory && (
                <span>
                  Subtopic <strong>{ticket.subCategory}</strong>
                </span>
              )}
              {ticket.seniorRecruiter && (
                <span>
                  Senior Recruiter <strong>{ticket.seniorRecruiter}</strong>
                </span>
              )}
              {ticket.recruiter && (
                <span>
                  Marketing TL <strong>{ticket.recruiter}</strong>
                </span>
              )}
              {(ticket.marketingTlEmail || ticket.salesPoc) && (
                <span>
                  Marketing TL Mail ID <strong>{ticket.marketingTlEmail || ticket.salesPoc}</strong>
                </span>
              )}
              {ticket.salesSenior && (
                <span>
                  Sr. Name <strong>{ticket.salesSenior}</strong>
                </span>
              )}
              {ticket.salesRep && (
                <span>
                  Sales Representative <strong>{ticket.salesRep}</strong>
                </span>
              )}
              <span>
                Team / Sub-team <strong>{ticket.team} ({ticket.subTeam || 'Placement'})</strong>
              </span>
              <span>
                Priority <Badge type={ticket.priority.toLowerCase()}>{ticket.priority}</Badge>
              </span>
            </div>
          </Info>

          {/* 24-Hour SLA Card */}
          <Info title="24-Hour SLA Status">
            <div className="side-data">
              <span>
                SLA State{' '}
                <strong className={ticket.slaState}>
                  {ticket.slaState === 'unassigned'
                    ? 'Pending Assignment'
                    : ticket.slaState === 'breached'
                    ? 'Breached'
                    : ticket.slaState === 'due'
                    ? 'Due Soon (<1h)'
                    : 'Healthy'}
                </strong>
              </span>
              <span>
                Remaining SLA{' '}
                <strong className={ticket.slaState}>
                  {ticket.sla}
                </strong>
              </span>
              {ticket.assignedAt && (
                <span>
                  Assignment Time <strong>{ticket.assignedAt}</strong>
                </span>
              )}
              {ticket.slaDeadline && (
                <span>
                  Resolution Deadline <strong>{ticket.slaDeadline}</strong>
                </span>
              )}
              {ticket.isRelaxed && (
                <span>
                  Relaxation Status{' '}
                  <strong style={{ color: 'var(--green)' }}>
                    +{ticket.relaxationCount * 24}h Extended
                  </strong>
                </span>
              )}
              {ticket.breachedAt && (
                <span>
                  Breach Recorded At{' '}
                  <strong style={{ color: 'var(--red)' }}>{ticket.breachedAt}</strong>
                </span>
              )}
            </div>
          </Info>

          {/* Assignment Card */}
          <Info title="Assignment Authority">
            <div className="assigned-user">
              <Avatar name={ticket.assignee || 'Unassigned'} />
              <div>
                <strong>{ticket.assignee || 'Unassigned'}</strong>
                <span>{ticket.assignedRole ? (ticket.assignedRole === 'sales_tl' ? 'Sales TL' : 'Marketing TL') : 'Pending PA Routing'}</span>
              </div>
            </div>
            {ticket.assignedBy && (
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--muted)' }}>
                Assigned by: <strong>{ticket.assignedBy}</strong>
              </div>
            )}
          </Info>

          {/* Attachments Card */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <Info title="Attachments & Files">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ticket.attachments.map((file, i) => {
                  // Support both old string format and new {name, type, dataUrl} format
                  const isObj = typeof file === 'object' && file !== null;
                  const fileName = isObj ? file.name : file;
                  const fileType = isObj ? (file.type || '') : '';
                  const dataUrl = isObj ? file.dataUrl : null;

                  const isImage = fileType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);
                  const isPdf = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
                  const isExcel = fileType.includes('spreadsheet') || /\.(xlsx|xls|csv)$/i.test(fileName);

                  const handleView = () => {
                    if (!dataUrl) return;
                    const win = window.open();
                    if (isImage) {
                      win.document.write(`<img src="${dataUrl}" style="max-width:100%;" />`);
                    } else {
                      win.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100vh;border:none;"></iframe>`);
                    }
                  };

                  const handleDownload = () => {
                    if (!dataUrl) return;
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = fileName;
                    a.click();
                  };

                  return (
                    <div key={i} className="attachment-detail-row">
                      <span className="attachment-detail-icon">
                        {isImage ? <Image size={14} /> : isExcel ? <FileSpreadsheet size={14} /> : <FileText size={14} />}
                      </span>
                      <span className="attachment-detail-name" title={fileName}>{fileName}</span>
                      <div className="attachment-detail-actions">
                        {dataUrl && (
                          <>
                            <button
                              className="attach-action-btn"
                              onClick={handleView}
                              title="View file"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              className="attach-action-btn"
                              onClick={handleDownload}
                              title="Download file"
                            >
                              <Download size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Info>
          )}
        </aside>
      </div>

      {/* ── Reopen Ticket Modal ── */}
      {showReopenModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowReopenModal(false)}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '480px',
              border: 'none',
              borderTop: '4px solid #f59e0b',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
              padding: '28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Reopen Ticket</h3>
                  <small style={{ color: 'var(--text-muted)' }}>Ticket ID: {ticket.id}</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              If you or the candidate are not satisfied with the resolution, explain the issue below. The ticket will return to <strong>In Progress</strong> and all team members will be alerted.
            </p>

            <form onSubmit={handleConfirmReopen}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Reason for Reopening <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Candidate reports proxy performance did not address requirements / issue still occurring..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg, #fff)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowReopenModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  icon={RotateCcw}
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff' }}
                >
                  Confirm Reopen
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function Analytics({ tickets = [] }) {
  const currentTickets = tickets && tickets.length ? tickets : getStoredTickets();
  const total = currentTickets.length;
  const mktCount = currentTickets.filter((t) => t.team === 'Marketing' || t.creatorRole === 'marketing_tl').length;
  const salesCount = currentTickets.filter((t) => t.team === 'Sales' || t.creatorRole === 'sales_tl').length;
  const otherCount = Math.max(0, total - mktCount - salesCount);
  const mktPct = total ? Math.round((mktCount / total) * 100) : 0;
  const salesPct = total ? Math.round((salesCount / total) * 100) : 0;
  const otherPct = total ? Math.max(0, 100 - mktPct - salesPct) : 0;

  const dynamicTeams = [
    { name: "Marketing", value: mktPct, count: mktCount, color: "#2563eb" },
    { name: "Sales", value: salesPct, count: salesCount, color: "#0ea5a4" },
    { name: "Quality Ops", value: otherPct, count: otherCount, color: "#f59e0b" },
  ];

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="INSIGHTS / REPORTING"
        title="Analytics & SLA Governance"
        subtitle="Operational metrics across Marketing, Sales, and SLA compliance."
      />
      <div className="dashboard-grid">
        <section className="section-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RESOLUTION VELOCITY</p>
              <h2>7-Day Ticket Volume & Resolution ({total} Total Tickets)</h2>
            </div>
          </div>
          <div className="trend-panel">
            <div className="chart-area tall">
              <div className="y-axis">
                <span>{Math.max(10, total + 5)}</span>
                <span>{Math.round((Math.max(10, total + 5) * 3) / 4)}</span>
                <span>{Math.round(Math.max(10, total + 5) / 2)}</span>
                <span>{Math.round(Math.max(10, total + 5) / 4)}</span>
                <span>0</span>
              </div>
              <div className="chart">
                <div className="grid-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="x-axis">
                  {analytics.labels.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DEPARTMENTAL DISTRIBUTION</p>
              <h2>Ticket Volume by Team</h2>
            </div>
          </div>
          {dynamicTeams.map((t) => (
            <div className="team-bar" key={t.name}>
              <div>
                <span>{t.name} ({t.count} tickets)</span>
                <strong>{t.value}%</strong>
              </div>
              <div className="bar-track">
                <i style={{ width: `${t.value}%`, background: t.color }} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function Notifications({ notifications = [], onMarkAllRead }) {
  const navigate = useNavigate();
  const list = notifications.length ? notifications : getStoredNotifications();
  const unreadCount = list.filter(n => n.unread).length;

  const typeIcon = (type) => {
    if (type === 'Breach' || type === 'Escalation' || type === 'escalated') return <AlertTriangle size={15} />;
    if (type === 'Reminder') return <Clock size={15} />;
    if (type === 'Re-Opened' || type === 'reopened') return <RefreshCw size={15} />;
    if (type === 'Reply') return <MessageSquare size={15} />;
    return <Bell size={15} />;
  };

  const typeClass = (type) => {
    if (type === 'Breach' || type === 'escalated' || type === 'Escalation') return 'type-escalation';
    if (type === 'Re-Opened' || type === 'reopened') return 'type-reopen';
    if (type === 'Reply') return 'type-reply';
    return '';
  };

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="SYSTEM / NOTIFICATIONS"
        title="Notifications"
        subtitle="Real-time alerts for ticket actions, SLA reminders, breaches, and email thread activity."
        action={
          unreadCount > 0 && onMarkAllRead ? (
            <button
              className="button button-secondary"
              style={{ fontSize: '13px', padding: '8px 16px' }}
              onClick={onMarkAllRead}
            >
              Mark all {unreadCount} read
            </button>
          ) : null
        }
      />
      <section className="section-panel notification-panel">
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Bell size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No notifications yet</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Notifications appear here when tickets are assigned, resolved, or updated.</p>
          </div>
        ) : (
          list.map((n) => (
            <div
              className={`notification-row ${n.unread ? 'unread' : ''}`}
              key={n.id}
              style={{ cursor: n.ticketId ? 'pointer' : 'default' }}
              onClick={() => n.ticketId && navigate(`/tickets/${n.ticketId}`)}
            >
              <div className={`notification-type ${typeClass(n.type)}`}>
                {typeIcon(n.type)}
              </div>
              <div>
                <strong>{n.title}</strong>
                <span>{n.detail}</span>
                {n.ticketId && (
                  <small style={{ color: 'var(--accent)', marginTop: '2px', display: 'block', fontSize: '11px' }}>
                    Ticket #{n.ticketId} → Click to view
                  </small>
                )}
                {n.metadata?.previewUrl && (
                  <a
                    href={n.metadata.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1d4ed8',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 600,
                      marginTop: '5px',
                      textDecoration: 'none',
                      width: 'fit-content',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📬 View Real Email in Browser ↗
                  </a>
                )}
              </div>
              <time>{n.time}</time>
              {n.unread && <span className="unread-dot" />}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function Activity({ activity = [] }) {
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    fetch('/api/email/audit-logs')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((log) => ({
            time: new Date(log.createdAt).toLocaleString([], {
              dateStyle: 'short',
              timeStyle: 'short',
            }),
            user: log.actor || 'System',
            role: log.eventType?.includes('EMAIL') ? 'Email Engine' : 'System',
            action: log.eventType?.replace(/_/g, ' ') || 'Action',
            ticket: log.ticketId ? `#${log.ticketId}` : 'System',
            previewUrl: log.metadata?.previewUrl || null,
            detail: log.subject
              ? `${log.subject} → ${log.recipient || 'Support'} [${log.deliveryStatus}]`
              : (log.metadata?.cleanBody || log.eventType),
          }));
          setAuditLogs(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const list = auditLogs.length
    ? [...auditLogs, ...(activity.length ? activity : seedActivity)]
    : (activity.length ? activity : seedActivity);

  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="SYSTEM / AUDIT TRAIL"
        title="Activity Log"
        subtitle="Immutable audit log of all ticket creations, assignments, SLA breaches, relaxations, and closures."
      />
      <section className="section-panel activity-log-panel">
        {list.map((a, i) => (
          <div className="audit-row" key={i}>
            <div className="audit-date">{a.time}</div>
            <div className="audit-copy">
              <strong>
                {a.user} <span>({a.role || 'System'})</span> · <b>{a.action}</b> on {a.ticket}
              </strong>
              <small>{a.detail}</small>
              {a.previewUrl && (
                <a
                  href={a.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    marginTop: '4px',
                    textDecoration: 'none',
                    width: 'fit-content',
                  }}
                >
                  📬 View Sent Email ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function SettingsPage({ role, currentUser }) {
  return (
    <div className="page page-enter">
      <PageHeader
        eyebrow="MANAGE / SETTINGS"
        title="Account Settings"
        subtitle="Manage active workspace account and profile settings."
      />
      <div className="settings-layout">
        <aside className="settings-nav">
          <button className="active">
            <UserRound size={16} /> Profile
          </button>
          <button>
            <Bell size={16} /> Notification Rules
          </button>
          <button>
            <Sparkles size={16} /> SLA Preferences
          </button>
        </aside>
        <section className="settings-content">
          <section className="section-panel profile-settings">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">AUTHENTICATED USER</p>
                <h2>Your Profile</h2>
              </div>
            </div>
            <div className="profile-hero">
              <Avatar name={currentUser} />
              <div>
                <h3>{currentUser}</h3>
                <p>{role.name} · {role.team}</p>
              </div>
              <Badge type="status">Active</Badge>
            </div>
            <div className="form-grid">
              <label>
                Assigned Role
                <input value={role.name} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
              </label>
              <label>
                Department / Workspace
                <input value={role.team} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
              </label>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

export function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [securityBlock, setSecurityBlock] = useState(() => {
    if (isClientMobile()) {
      return {
        blocked: true,
        reason: 'MOBILE_DEVICE_BLOCKED',
        title: 'Desktop Access Required',
        message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
      };
    }
    return null;
  });

  useEffect(() => {
    const handleResize = () => {
      if (isClientMobile()) {
        setSecurityBlock({
          blocked: true,
          reason: 'MOBILE_DEVICE_BLOCKED',
          title: 'Desktop Access Required',
          message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);

    // Gate 1: Strict Mobile Block
    if (isClientMobile()) {
      setLoading(false);
      setSecurityBlock({
        blocked: true,
        reason: 'MOBILE_DEVICE_BLOCKED',
        title: 'Desktop Access Required',
        message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
      });
      return;
    }

    try {
      // 1. Fetch directory users from MongoDB / local storage
      const usersList = await userApi.list();
      const input = email.trim().toLowerCase();

      // 2. Find user by email, user ID (e.g. USR-101), or full name
      const matched = usersList.find(
        (u) =>
          (u.email && u.email.trim().toLowerCase() === input) ||
          (u.id && u.id.trim().toLowerCase() === input) ||
          (u.name && u.name.trim().toLowerCase() === input)
      );

      if (!matched) {
        setLoading(false);
        setError('Account not found in Directory. Please enter a valid registered email or User ID.');
        return;
      }

      // 3. Validate password
      const storedPassword = matched.password || 'password123';
      if (password.trim() !== storedPassword) {
        setLoading(false);
        setError('Invalid password. Kindly enter the correct password.');
        return;
      }

      // Gates 2 & 3: Authoritative Backend Security Gate Verification
      const deviceId = getOrCreateDeviceId();
      const deviceName = getDeviceFriendlyName();
      const isStation = isProcessTeamStation() || (matched && matched.role === 'process_analyst');
      const secRes = await securityApi.verifyAccess({
        emailOrId: input,
        deviceId,
        deviceName,
        isProcessTeamStation: isStation,
      });

      if (!secRes.ok || (secRes.data && secRes.data.allowed === false)) {
        setLoading(false);
        const secInfo = secRes.data || {};
        setSecurityBlock({
          blocked: true,
          reason: secInfo.reason || 'OUTSIDE_WORKING_HOURS',
          title: secInfo.title || 'Access Restricted',
          message: secInfo.message || 'Access is currently restricted by security policy.',
        });
        return;
      }

      // 4. Resolve role and log in
      const updatedUser = (secRes.data && secRes.data.user) ? secRes.data.user : matched;

      // If user is a process analyst, persistently register this browser/machine as an authorized Process Team Station
      if (updatedUser.role === 'process_analyst') {
        markProcessTeamStation(true);
      }

      const targetRole =
        roles.find((r) => r.id === updatedUser.role) ||
        roles.find((r) => r.name.toLowerCase() === (updatedUser.roleName || '').toLowerCase()) ||
        roles[0];

      setTimeout(() => {
        setLoading(false);
        onLogin && onLogin(updatedUser, targetRole);
      }, 300);
    } catch (err) {
      setLoading(false);
      setError('An error occurred during authentication. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <svg className="login-ambient-shape shape-1" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="shape-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="40" stroke="url(#shape-grad-1)" strokeWidth="18" strokeLinecap="round" />
      </svg>
      <svg className="login-ambient-shape shape-2" viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="shape-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M 40 140 C 40 70, 160 70, 160 140 C 160 180, 100 180, 100 130" stroke="url(#shape-grad-2)" strokeWidth="26" strokeLinecap="round" />
      </svg>
      <svg className="login-ambient-shape shape-3" viewBox="0 0 240 240" fill="none">
        <defs>
          <linearGradient id="shape-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M 50 180 C 20 80, 180 40, 200 120 C 210 180, 120 220, 70 170" stroke="url(#shape-grad-3)" strokeWidth="22" strokeLinecap="round" />
      </svg>
      <svg className="login-ambient-shape shape-4" viewBox="0 0 200 100" fill="none">
        <defs>
          <linearGradient id="shape-grad-4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M 20 50 Q 60 10, 100 50 T 180 50" stroke="url(#shape-grad-4)" strokeWidth="20" strokeLinecap="round" />
      </svg>

      <div className="login-bg-logo-wrap" aria-hidden="true">
        <img src={nbLogo} alt="NetBounce Logo" className="login-bg-logo-img" />
      </div>

      <div className="login-card">
        <h1 className="login-heading">Login</h1>
        {isProcessTeamStation() && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(147, 197, 253, 0.4)',
            color: '#bfdbfe',
            fontSize: '11px',
            fontWeight: 600,
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            <ShieldCheck size={13} color="#60a5fa" />
            Process Team Workstation &bull; Internal Multi-User Access
          </div>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#ffffff',
              fontSize: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}
          <div className="login-field">
            <label htmlFor="login-email">Email or User ID</label>
            <input
              id="login-email"
              type="text"
              className="login-input"
              placeholder="e.g. amit.verma@netbounce.com or USR-101"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
              autoComplete="username"
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="login-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="login-forgot">
            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                setShowForgotModal(true);
              }}
            >
              Forgot Password?
            </a>
          </div>
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
            data-testid="login-submit-button"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer-text" style={{ marginTop: '24px' }}>
          <span>Enterprise Ticketing & 24h SLA System</span>
        </div>
      </div>

      {/* Forgot Password Popup Modal */}
      {showForgotModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-dialog" style={{
            maxWidth: '430px',
            textAlign: 'center',
            padding: '36px 30px',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 29, 53, 0.35)',
            background: '#ffffff',
          }}>
            <div style={{
              width: '56px', height: '56px',
              borderRadius: '50%',
              background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <KeyRound size={26} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
              Account Assistance
            </h3>
            <p style={{
              color: '#1e293b',
              fontSize: '14px',
              lineHeight: '1.6',
              marginBottom: '18px',
              fontWeight: 600,
            }}>
              Kindly coordinate with the Process Analyst team to change the current ID or password.
            </p>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              color: '#64748b',
              lineHeight: '1.5',
              marginBottom: '24px',
              textAlign: 'left',
            }}>
              ℹ️ Process Analysts manage the NetBounce Active Directory and can update login credentials or reset passwords upon verification.
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                width: '100%',
                padding: '11px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              }}
            >
              OK, Understood
            </button>
          </div>
        </div>,
        document.body
      )}

      {securityBlock && createPortal(
        <SecurityBlockedModal
          reason={securityBlock.reason}
          title={securityBlock.title}
          message={securityBlock.message}
          onRetry={async () => {
            if (isClientMobile()) {
              return;
            }
            const res = await securityApi.verifyAccess({
              emailOrId: email.trim(),
              deviceId: getOrCreateDeviceId(),
              deviceName: getDeviceFriendlyName(),
            });
            if (res.ok && res.data && res.data.allowed === true) {
              setSecurityBlock(null);
            } else if (res.data) {
              setSecurityBlock({
                blocked: true,
                reason: res.data.reason || securityBlock.reason,
                title: res.data.title || securityBlock.title,
                message: res.data.message || securityBlock.message,
              });
            }
          }}
          onClose={!isClientMobile() ? () => setSecurityBlock(null) : undefined}
        />,
        document.body
      )}
    </div>
  );
}

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="state-page">
      <div className="state-code">404</div>
      <p className="eyebrow">NOT FOUND</p>
      <h1>That page took a wrong turn.</h1>
      <Button
        data-testid="not-found-dashboard-button"
        onClick={() => navigate('/dashboard')}
      >
        Back to dashboard
      </Button>
    </div>
  );
}

export function Shell({ role, currentUser, onSignOut, onSwitchUser }) {
  const location = useLocation();

  // Persistent tickets & users state
  const [ticketsState, setTicketsState] = useState(() => getStoredTickets());
  const [usersState, setUsersState] = useState(() => getStoredUsers());
  const [notifsState, setNotifsState] = useState(() => getStoredNotifications());
  const [shellSecurityBlock, setShellSecurityBlock] = useState(null);

  // Periodic Security Schedule & Device Monitor
  useEffect(() => {
    const checkSecurityStatus = () => {
      if (isClientMobile()) {
        setShellSecurityBlock({
          reason: 'MOBILE_DEVICE_BLOCKED',
          title: 'Desktop Access Required',
          message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
        });
        return;
      }
      let authedUser = null;
      try {
        const stored = sessionStorage.getItem('authUser');
        if (stored) authedUser = JSON.parse(stored);
      } catch (e) {}

      const sched = evaluateClientSchedule(authedUser);
      if (!sched.allowed) {
        setShellSecurityBlock({
          reason: sched.reason,
          title: sched.title,
          message: sched.message,
        });
      } else {
        setShellSecurityBlock(null);
      }
    };

    checkSecurityStatus();
    const interval = setInterval(checkSecurityStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time WebSocket synchronization (Socket.io)
  useEffect(() => {
    let socket;
    try {
      const envApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const socketServer = (isHttps && envApiUrl.startsWith('http://')) ? undefined : (envApiUrl || undefined);
      socket = io(socketServer, {
        transports: ['polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      const refreshTickets = () => {
        ticketApi.list().then((list) => {
          if (Array.isArray(list)) setTicketsState(list);
        }).catch(() => {});
      };

      const refreshNotifs = () => {
        notificationApi.list().then((list) => {
          if (Array.isArray(list)) {
            saveStoredNotifications(list);
            setNotifsState(list);
          }
        }).catch(() => {});
      };

      socket.on('ticket_created', refreshTickets);
      socket.on('ticket_assigned', refreshTickets);
      socket.on('ticket_resolved', refreshTickets);
      socket.on('tickets_changed', refreshTickets);
      socket.on('notification_new', refreshNotifs);
    } catch (e) {
      console.warn('Socket.io listener error:', e);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Continuous background poll every 3 seconds as rock-solid fallback
  useEffect(() => {
    let isMounted = true;
    const fetchFresh = () => {
      ticketApi.list().then((list) => {
        if (isMounted && Array.isArray(list)) {
          setTicketsState(list);
        }
      }).catch(() => {});
      userApi.list().then((uList) => {
        if (isMounted && Array.isArray(uList)) {
          setUsersState(uList);
        }
      }).catch(() => {});
    };
    fetchFresh();
    const interval = setInterval(fetchFresh, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  // Poll notifications from backend every 5 seconds for live badge updates
  useEffect(() => {
    let isMounted = true;
    const pollNotifs = () => {
      notificationApi.list().then((list) => {
        if (isMounted && Array.isArray(list)) {
          saveStoredNotifications(list);
          setNotifsState(list);
        }
      }).catch(() => {});
    };
    pollNotifs();
    const notifInterval = setInterval(pollNotifs, 5000);
    return () => {
      isMounted = false;
      clearInterval(notifInterval);
    };
  }, []);

  // Actions
  const handleAssign = async (ticketId, assigneeUser, paName) => {
    await ticketApi.assign(ticketId, assigneeUser, paName);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleEscalate = async (ticketId) => {
    await ticketApi.escalate(ticketId, currentUser);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleRelax = async (ticketId) => {
    await ticketApi.relax(ticketId, currentUser);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleResolve = async (ticketId, userName, userRole) => {
    await ticketApi.resolve(ticketId, userName, userRole);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleReopen = async (ticketId, userName, userRole, reason) => {
    await ticketApi.reopen(ticketId, userName, userRole, reason);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleAddReply = async (ticketId, userName, userRole, text) => {
    await ticketApi.addReply(ticketId, userName, userRole, text);
    const updatedList = await ticketApi.list();
    setTicketsState(updatedList);
  };

  const handleCreateTicket = async (payload) => {
    await ticketApi.create(payload);
    const fresh = await ticketApi.list();
    setTicketsState(fresh);
  };

  const handleAddUser = async (newUser) => {
    const saved = await userApi.create(newUser);
    const updated = [...usersState.filter(u => u.id !== saved.id), saved];
    saveStoredUsers(updated);
    setUsersState(updated);
  };

  const handleDeleteTicket = async (ticketId) => {
    await ticketApi.delete(ticketId);
    const updated = getStoredTickets();
    setTicketsState(updated);
  };

  const handleDeleteUser = async (userId) => {
    await userApi.delete(userId);
    const updated = getStoredUsers();
    setUsersState(updated);
  };

  const handleEditUser = async (updatedUser) => {
    await userApi.update(updatedUser);
    const updated = getStoredUsers();
    setUsersState(updated);
  };

  const title = location.pathname.split('/')[1] || 'dashboard';

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        currentUser={currentUser}
        tickets={ticketsState}
        onSignOut={onSignOut}
      />
      <div className="main-shell">
        <Header
          title={
            title === 'tickets'
              ? 'Ticket Management'
              : title === 'breaches'
              ? 'SLA Breaches'
              : title === 'users'
              ? 'User Management'
              : title.charAt(0).toUpperCase() + title.slice(1)
          }
          currentRole={role}
          currentUser={currentUser}
          onSignOut={onSignOut}
          notifications={notifsState}
        />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  key={`${role.id}-${currentUser}`}
                  role={role}
                  currentUser={currentUser}
                  tickets={ticketsState}
                  onAssign={handleAssign}
                  onEscalate={handleEscalate}
                  onRelax={handleRelax}
                />
              }
            />
            <Route
              path="/live-queue"
              element={<TicketsPage key={`${role.id}-${currentUser}-live`} routeFilter="live" role={role} currentUser={currentUser} tickets={ticketsState} onDeleteTicket={handleDeleteTicket} />}
            />
            <Route
              path="/tickets"
              element={<TicketsPage key={`${role.id}-${currentUser}`} role={role} currentUser={currentUser} tickets={ticketsState} onDeleteTicket={handleDeleteTicket} />}
            />
            <Route
              path="/tickets/new"
              element={
                <CreateTicket
                  key={`${role.id}-${currentUser}`}
                  role={role}
                  currentUser={currentUser}
                  onCreateTicket={handleCreateTicket}
                />
              }
            />
            <Route
              path="/breaches"
              element={
                <BreachPage
                  tickets={ticketsState}
                  onEscalate={handleEscalate}
                  onRelax={handleRelax}
                />
              }
            />
            <Route
              path="/users"
              element={
                <UserManagementPage
                  users={usersState}
                  role={role}
                  currentUser={currentUser}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onEditUser={handleEditUser}
                  onSwitchUser={onSwitchUser}
                />
              }
            />
            {Object.keys(slugs).map((key) => (
              <Route
                path={`/tickets/${key}`}
                element={<TicketsPage routeFilter={key} role={role} currentUser={currentUser} tickets={ticketsState} onDeleteTicket={handleDeleteTicket} />}
                key={`${key}-${role.id}-${currentUser}`}
              />
            ))}
            <Route
              path="/tickets/:ticketId"
              element={
                <TicketDetail
                  role={role}
                  currentUser={currentUser}
                  tickets={ticketsState}
                  onAssign={handleAssign}
                  onEscalate={handleEscalate}
                  onRelax={handleRelax}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onAddReply={handleAddReply}
                />
              }
            />
            <Route path="/analytics" element={<Analytics tickets={ticketsState} />} />
            <Route
              path="/notifications"
              element={
                <Notifications
                  notifications={notifsState}
                  onMarkAllRead={async () => {
                    await notificationApi.markAllRead();
                    const fresh = await notificationApi.list();
                    if (Array.isArray(fresh)) {
                      saveStoredNotifications(fresh);
                      setNotifsState(fresh);
                    }
                  }}
                />
              }
            />
            <Route path="/activity" element={<Activity />} />
            <Route
              path="/settings"
              element={<SettingsPage role={role} currentUser={currentUser} />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>

      {shellSecurityBlock && createPortal(
        <SecurityBlockedModal
          reason={shellSecurityBlock.reason}
          title={shellSecurityBlock.title}
          message={shellSecurityBlock.message}
          onClose={onSignOut}
        />,
        document.body
      )}
    </div>
  );
}

export default function AppEnhanced() {
  const [role, setRole] = useState(() => {
    const savedId = sessionStorage.getItem('demoRole');
    return roles.find((r) => r.id === savedId) || roles[0];
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = sessionStorage.getItem('demoUser');
    return savedUser || role.defaultUser || 'Amit Verma';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAuthenticated') === 'true' || !!sessionStorage.getItem('demoUser');
  });

  const handleLogin = (user, userRole) => {
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('demoRole', userRole.id);
    sessionStorage.setItem('demoUser', user.name);
    sessionStorage.setItem('authUser', JSON.stringify(user));
    setRole(userRole);
    setCurrentUser(user.name);
    setIsAuthenticated(true);
  };

  const handleSwitchUser = (user, userRole) => {
    sessionStorage.setItem('demoRole', userRole.id);
    sessionStorage.setItem('demoUser', user.name);
    sessionStorage.setItem('authUser', JSON.stringify(user));
    setRole(userRole);
    setCurrentUser(user.name);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('demoRole');
    sessionStorage.removeItem('demoUser');
    sessionStorage.removeItem('authUser');
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Shell
                role={role}
                currentUser={currentUser}
                onSignOut={handleSignOut}
                onSwitchUser={handleSwitchUser}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
