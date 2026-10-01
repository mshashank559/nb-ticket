import express from 'express';
import { User } from '../models/User.js';
import { SecurityAuditLog } from '../models/SecurityAuditLog.js';
import { evaluateSecurityAccess, evaluateWorkingHours, isMobileDevice } from '../services/securityEngine.js';

const router = express.Router();

// Helper to log security audit events
async function logSecurityEvent({ userId, userName, userRole, eventType, performedBy, reason, req, deviceInfo }) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    await SecurityAuditLog.create({
      id: `SEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: userId || 'ANONYMOUS',
      userName: userName || 'Unknown',
      userRole: userRole || 'Unknown',
      eventType,
      performedBy: performedBy || { name: 'System Gatekeeper' },
      reason: reason || '',
      ip: String(ip),
      deviceInfo: deviceInfo || (req ? req.headers['user-agent'] : ''),
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('[SecurityAuditLog Error]:', err.message);
  }
}

// POST /api/security/verify-access
// Main security gate endpoint called during login and periodic session checks
router.post('/verify-access', async (req, res) => {
  try {
    const { emailOrId, deviceId, deviceName } = req.body;

    // 1. Mobile Check Gate
    if (isMobileDevice(req)) {
      await logSecurityEvent({
        userId: emailOrId,
        eventType: 'ACCESS_DENIED_MOBILE',
        reason: 'Mobile device attempted access',
        req,
      });
      return res.status(403).json({
        allowed: false,
        reason: 'MOBILE_DEVICE_BLOCKED',
        title: 'Desktop Access Required',
        message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
      });
    }

    // 2. Schedule Check Gate
    const schedule = evaluateWorkingHours();

    // 3. User lookup if email/id provided
    let user = null;
    if (emailOrId) {
      const input = emailOrId.trim().toLowerCase();
      user = await User.findOne({
        $or: [
          { email: new RegExp(`^${input}$`, 'i') },
          { id: new RegExp(`^${input}$`, 'i') },
          { name: new RegExp(`^${input}$`, 'i') },
        ],
      });
    }

    // If outside hours, check if it's weekend with PA grant
    if (!schedule.allowed) {
      const hasWeekendGrant = schedule.isWeekend && user && user.weekendAccess === true;
      if (!hasWeekendGrant) {
        await logSecurityEvent({
          userId: user ? user.id : emailOrId,
          userName: user ? user.name : 'Unknown',
          userRole: user ? user.role : 'Unknown',
          eventType: schedule.isWeekend ? 'ACCESS_DENIED_WEEKEND' : 'ACCESS_DENIED_HOURS',
          reason: `Schedule restriction: ${schedule.reason}`,
          req,
        });
        return res.status(403).json({
          allowed: false,
          reason: schedule.reason,
          title: schedule.title,
          message: schedule.message,
        });
      }
    }

    // 4. Device Binding Check (Protocol #3)
    if (user && deviceId) {
      if (user.deviceStatus === 'REVOKED') {
        await logSecurityEvent({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          eventType: 'ACCESS_DENIED_DEVICE',
          reason: 'Attempted login from revoked device',
          req,
          deviceInfo: deviceName,
        });
        return res.status(403).json({
          allowed: false,
          reason: 'DEVICE_REVOKED',
          title: 'Device Access Revoked',
          message: 'Your device access has been revoked by a security administrator. Please contact your Process Analyst.',
        });
      }

      // If user already has a trusted device enrolled
      if (user.trustedDeviceId && user.trustedDeviceId.trim() !== '') {
        if (user.trustedDeviceId !== deviceId) {
          await logSecurityEvent({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            eventType: 'ACCESS_DENIED_DEVICE',
            reason: `Unmatched device ID attempt. Registered: ${user.trustedDeviceId}, Provided: ${deviceId}`,
            req,
            deviceInfo: deviceName,
          });
          return res.status(403).json({
            allowed: false,
            reason: 'UNAUTHORIZED_DEVICE',
            title: 'Device Not Authorized',
            message: 'This device is not registered for your account. Please log in from your authorized company machine or contact your Process Analyst to reset your device enrollment.',
          });
        }
      } else {
        // First-time enrollment: bind this device to user!
        user.trustedDeviceId = deviceId;
        user.trustedDeviceName = deviceName || 'Company Machine';
        user.deviceEnrolledAt = new Date().toISOString();
        user.deviceStatus = 'ACTIVE';
        await user.save();

        await logSecurityEvent({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          eventType: 'DEVICE_ENROLLED',
          reason: `Auto-enrolled first authorized device: ${deviceName || deviceId}`,
          req,
          deviceInfo: deviceName,
        });
      }

      // Update last login metadata
      user.lastLoginAt = new Date().toISOString();
      user.lastLoginDevice = deviceName || 'Company Desktop';
      await user.save();
    }

    return res.json({ allowed: true, user });
  } catch (error) {
    console.error('[VerifyAccess Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/security/audit-logs - List recent audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await SecurityAuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/security/toggle-weekend-access - Process Analyst grants or revokes weekend access
router.post('/toggle-weekend-access', async (req, res) => {
  try {
    const { targetUserId, weekendAccess, performedBy, reason } = req.body;
    const targetUser = await User.findOne({ id: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const previousState = targetUser.weekendAccess;
    targetUser.weekendAccess = Boolean(weekendAccess);
    await targetUser.save();

    const eventType = weekendAccess ? 'WEEKEND_ACCESS_GRANTED' : 'WEEKEND_ACCESS_REVOKED';
    await logSecurityEvent({
      userId: targetUser.id,
      userName: targetUser.name,
      userRole: targetUser.role,
      eventType,
      performedBy: performedBy || { name: 'Process Analyst' },
      reason: reason || (weekendAccess ? 'Weekend access explicitly granted' : 'Weekend access revoked'),
      req,
    });

    res.json({
      success: true,
      message: `Weekend access ${weekendAccess ? 'granted' : 'revoked'} for ${targetUser.name}`,
      user: targetUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/security/reset-device - Process Analyst / Admin resets device enrollment
router.post('/reset-device', async (req, res) => {
  try {
    const { targetUserId, performedBy, reason } = req.body;
    const targetUser = await User.findOne({ id: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const oldDeviceName = targetUser.trustedDeviceName;
    targetUser.trustedDeviceId = '';
    targetUser.trustedDeviceName = '';
    targetUser.deviceStatus = 'ACTIVE';
    targetUser.deviceEnrolledAt = '';
    await targetUser.save();

    await logSecurityEvent({
      userId: targetUser.id,
      userName: targetUser.name,
      userRole: targetUser.role,
      eventType: 'DEVICE_RESET',
      performedBy: performedBy || { name: 'Process Analyst' },
      reason: reason || `Reset device enrollment (previously: ${oldDeviceName || 'Unlabeled'})`,
      req,
    });

    res.json({
      success: true,
      message: `Device enrollment successfully reset for ${targetUser.name}. User can register new device on next login.`,
      user: targetUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
