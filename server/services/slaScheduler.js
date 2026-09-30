import { Ticket } from '../models/Ticket.js';
import { emailService } from './emailService.js';

class SlaScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start(intervalMs = 60000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[SLAScheduler] SLA Monitoring Background Worker started (interval: ${intervalMs / 1000}s)`);
    // Run an initial check after 5 seconds, then recurring
    setTimeout(() => this.checkSLA(), 5000);
    this.intervalId = setInterval(() => this.checkSLA(), intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    console.log('[SLAScheduler] Worker stopped.');
  }

  async checkSLA() {
    try {
      const now = Date.now();
      // Find tickets that are In Progress or Open and have an slaDeadline set
      const tickets = await Ticket.find({
        status: { $in: ['In Progress', 'Open', 'New'] },
        slaDeadline: { $exists: true, $ne: null },
      });

      for (const ticket of tickets) {
        if (!ticket.slaDeadline) continue;

        const deadlineDate = new Date(ticket.slaDeadline);
        if (isNaN(deadlineDate.getTime())) continue;

        const diff = deadlineDate.getTime() - now;
        const totalDuration = 24 * 60 * 60 * 1000;
        const hoursLeft = diff / (1000 * 60 * 60);

        // 1. SLA Reminder (Pre-escalation alert):
        // Triggered when approaching deadline (e.g., between 1 hour and 4 hours left, i.e., 20+ hours into 24-hr window)
        // Ensure reminder is only sent once per ticket lifecycle
        if (diff > 0 && hoursLeft <= 4 && !ticket.reminderSent) {
          console.log(`[SLAScheduler] Triggering 4h Pre-Escalation Reminder for Ticket #${ticket.id}`);
          
          const timeRemainingStr = `${Math.floor(hoursLeft)}h ${Math.floor((diff % 3600000) / 60000)}m`;
          
          await emailService.sendTicketNotification('reminder', ticket, {
            assignedTo: ticket.assignee,
            slaDeadline: deadlineDate.toLocaleString(),
            timeRemaining: timeRemainingStr,
            currentStatus: ticket.status,
          });

          await Ticket.updateOne(
            { id: ticket.id },
            {
              $set: { reminderSent: true },
              $push: {
                timeline: {
                  $each: [{
                    title: 'SLA Reminder Alert',
                    detail: `Automated reminder: SLA deadline approaches in ${timeRemainingStr}.`,
                    time: 'Just now',
                    type: 'activity',
                  }],
                  $position: 0,
                },
              },
            }
          );
        }

        // 2. SLA Breach & Escalation:
        // Triggered when diff <= 0 and ticket is not resolved and not already marked breached
        if (diff <= 0 && !ticket.slaBreached) {
          console.log(`[SLAScheduler] SLA Breached for Ticket #${ticket.id}! Escalating to Governance.`);

          await emailService.sendTicketNotification('escalated', ticket, {
            escalatedTo: 'Process Analyst & Management',
            team: ticket.team,
            assignedTo: ticket.assignee,
            slaDeadline: deadlineDate.toLocaleString(),
          });

          await Ticket.updateOne(
            { id: ticket.id },
            {
              $set: {
                slaBreached: true,
                slaState: 'breached',
                sla: 'Breached',
                breachedAt: new Date(),
              },
              $push: {
                timeline: {
                  $each: [{
                    title: 'SLA Breached',
                    detail: `Ticket exceeded 24-hour resolution SLA window. Automated breach alert fired.`,
                    time: 'Just now',
                    type: 'breach',
                  }],
                  $position: 0,
                },
                thread: {
                  id: `msg-${Date.now()}`,
                  name: 'System Alert',
                  role: 'Automated Bot',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  text: `🚨 SLA Deadline Breached: 24 hours have elapsed without resolution. Process Analyst alert generated.`,
                  mine: false,
                  isSystem: true,
                },
              },
            }
          );
        }
      }
    } catch (err) {
      console.error('[SLAScheduler] Error during SLA check:', err.message);
    }
  }
}

export const slaScheduler = new SlaScheduler();
