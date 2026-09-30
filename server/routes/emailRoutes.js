import express from 'express';
import { emailService } from '../services/emailService.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

// POST /api/email/inbound - Inbound Email Processing Webhook
// Can be called by SendGrid Inbound Parse, Mailgun, AWS SES, or direct HTTP simulation
router.post('/inbound', async (req, res) => {
  try {
    const { from, subject, text, body, inReplyTo, references, headers } = req.body;

    const result = await emailService.processIncomingEmail({
      from: from || req.body.sender || req.body.From,
      subject: subject || req.body.Subject,
      text: text || body || req.body['stripped-text'] || req.body.html || '',
      inReplyTo,
      references,
      headers: headers || {},
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      message: 'Inbound email processed successfully into ticket thread',
      result,
    });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/email/test-send - Test email dispatch
router.post('/test-send', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const result = await emailService.sendEmail({
      to: to || 'test@example.com',
      subject: subject || 'NetBounce Test Email Notification',
      text: text || 'This is a test notification from NetBounce Support email service.',
      ticketId: 'TEST-001',
      auditEventType: 'TEST_EMAIL_SENT',
      actor: 'Admin',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/email/audit-logs - View audit trail
router.get('/audit-logs', async (req, res) => {
  try {
    const { ticketId, limit = 50 } = req.query;
    const query = ticketId ? { ticketId } : {};
    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/email/config - View current email configuration status (safe, no secrets)
router.get('/config', (req, res) => {
  res.json({
    supportEmail: emailService.supportEmail,
    supportName: emailService.supportName,
    smtpConfigured: !!emailService.transporter,
    smtpHost: process.env.SMTP_HOST || 'Not Configured (Simulation Mode)',
    smtpPort: process.env.SMTP_PORT || '587',
    appUrl: process.env.APP_URL || 'http://localhost:5173',
  });
});

export default router;
