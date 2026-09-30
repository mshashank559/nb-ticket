import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
  name: { type: String, default: 'attachment' },
  size: { type: Number, default: 0 },
  type: { type: String, default: 'application/octet-stream' },
  data: { type: String }, // Base64 data string
  uploadedAt: { type: String, default: () => new Date().toISOString() },
}, { _id: true, strict: false });

const ConversationSchema = new mongoose.Schema({
  author: { type: String, default: 'User' },
  role: { type: String, default: 'user' },
  time: { type: String, default: 'Just now' },
  text: { type: String, default: '' },
  isPa: { type: Boolean, default: false },
}, { _id: true, strict: false });

const TimelineSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  detail: { type: String, default: '' },
  time: { type: String, default: 'Just now' },
  type: { type: String, default: 'activity' },
}, { _id: true, strict: false });

const TicketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  team: { type: String, default: 'Marketing' },
  candidate: { type: String, default: '' },
  candidateName: { type: String, default: '' },
  candidatePhone: { type: String, default: '' },
  candidateEmail: { type: String, default: '' },
  experience: { type: String, default: '' },
  recruiterInfo: { type: String, default: '' },
  marketingTopic: { type: String, default: '' },
  marketingSubtopic: { type: String, default: '' },
  salesIssue: { type: String, default: '' },
  priority: { type: String, default: 'P2' },
  status: { type: String, default: 'New' },
  assignee: { type: String, default: 'Unassigned' },
  assigneeRole: { type: String, default: '' },
  assignedAt: { type: mongoose.Schema.Types.Mixed },
  assignedBy: { type: String, default: '' },
  sla: { type: String, default: 'Not Started' },
  slaDeadline: { type: mongoose.Schema.Types.Mixed },
  slaState: { type: String, default: 'unassigned' },
  slaBreached: { type: Boolean, default: false },
  slaRelaxed: { type: Boolean, default: false },
  relaxedBy: { type: String, default: '' },
  relaxedAt: { type: mongoose.Schema.Types.Mixed },
  relaxationReason: { type: String, default: '' },
  escalatedTo: { type: String, default: '' },
  escalatedAt: { type: mongoose.Schema.Types.Mixed },
  escalationReason: { type: String, default: '' },
  resolvedAt: { type: mongoose.Schema.Types.Mixed },
  resolutionNotes: { type: String, default: '' },
  reopenedAt: { type: mongoose.Schema.Types.Mixed },
  reopenedBy: { type: String, default: '' },
  reopenReason: { type: String, default: '' },
  creatorRole: { type: String, default: 'marketing_tl' },
  creatorName: { type: String, default: '' },
  created: { type: String, default: () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
  attachments: [AttachmentSchema],
  conversation: [ConversationSchema],
  timeline: [TimelineSchema],
  thread: { type: mongoose.Schema.Types.Mixed, default: [] },
}, {
  timestamps: true,
  strict: false,
});

export const Ticket = mongoose.model('Ticket', TicketSchema);
