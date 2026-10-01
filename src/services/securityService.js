// Client-side Security Service for NetBounce Ticketing System
// Enforces Desktop-only, Shift timing, Weekend restriction, and Trusted Device Enrollment

const DEVICE_ID_KEY = 'netbounce_device_token_v1';

/**
 * Gets or creates a persistent unique client device identifier.
 */
export function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = `DEV-${crypto.randomUUID()}`;
      } else {
        id = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      }
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return `DEV-FALLBACK-${Date.now()}`;
  }
}

/**
 * Derives a human-friendly operating system & browser device label.
 */
export function getDeviceFriendlyName() {
  const ua = navigator.userAgent;
  let os = 'Desktop PC';
  if (ua.indexOf('Mac OS X') !== -1 || ua.indexOf('Macintosh') !== -1) os = 'Apple Mac';
  else if (ua.indexOf('Windows') !== -1) os = 'Windows PC';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux PC';

  let browser = 'Browser';
  if (ua.indexOf('Chrome') !== -1 && ua.indexOf('Edg') === -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Edg') !== -1) browser = 'Edge';
  else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';

  return `${os} (${browser})`;
}

/**
 * Strictly checks if the client device is a mobile phone or tablet.
 */
export function isClientMobile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // 1. Client Hints API
  if (navigator.userAgentData && navigator.userAgentData.mobile === true) {
    return true;
  }

  // 2. User Agent regex
  const ua = (navigator.userAgent || '').toLowerCase();
  const mobileRegex = /(android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|webos|silk|fennec)/i;
  if (mobileRegex.test(ua)) {
    return true;
  }

  // 3. Pointer & screen touch profile check
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  if (isTouch && window.innerWidth < 820 && window.screen.width < 820) {
    return true;
  }

  return false;
}

/**
 * Evaluates working schedule locally in Asia/Kolkata (IST).
 * Monday -> Friday, 7:30 PM (19:30) to 4:30 AM (04:30) next morning.
 */
export function evaluateClientSchedule(user) {
  try {
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hourCycle: 'h23',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
    });

    const parts = istFormatter.formatToParts(now);
    const partMap = {};
    parts.forEach((p) => { partMap[p.type] = p.value; });

    const weekday = partMap.weekday; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);
    const currentMinutes = hour * 60 + minute;

    const SHIFT_START = 19 * 60 + 30; // 19:30
    const SHIFT_END = 4 * 60 + 30;    // 04:30

    let isInsideShift = false;
    if (weekday === 'Mon' && currentMinutes >= SHIFT_START) isInsideShift = true;
    else if (weekday === 'Tue' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
    else if (weekday === 'Wed' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
    else if (weekday === 'Thu' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
    else if (weekday === 'Fri' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
    else if (weekday === 'Sat' && currentMinutes <= SHIFT_END) isInsideShift = true;

    if (isInsideShift) {
      return { allowed: true };
    }

    const isWeekend =
      (weekday === 'Sat' && currentMinutes > SHIFT_END) ||
      weekday === 'Sun' ||
      (weekday === 'Mon' && currentMinutes < SHIFT_START);

    if (isWeekend) {
      // If user has weekendAccess granted by Process Analyst, allow!
      if (user && user.weekendAccess === true) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'WEEKEND_ACCESS_RESTRICTED',
        title: 'Weekend Access Restricted',
        message: 'Weekend access is currently restricted. Please contact your Process Analyst if you require authorized access.',
      };
    }

    // Weekday outside shift
    if (currentMinutes < SHIFT_START && currentMinutes > SHIFT_END) {
      if (currentMinutes >= 18 * 60) {
        return {
          allowed: false,
          reason: 'BEFORE_WORKING_HOURS',
          title: 'Access Opens at 7:30 PM',
          message: 'The NetBounce Ticketing System is currently outside its scheduled working window. Access opens at 7:30 PM.',
        };
      }
      return {
        allowed: false,
        reason: 'AFTER_WORKING_HOURS',
        title: 'Access Window Closed',
        message: 'The NetBounce Ticketing System is currently outside its scheduled access hours. Next access opens at 7:30 PM.',
      };
    }

    return { allowed: true };
  } catch (e) {
    return { allowed: true };
  }
}

/**
 * API client methods for security endpoints.
 */
export const securityApi = {
  verifyAccess: async ({ emailOrId, deviceId, deviceName }) => {
    try {
      const res = await fetch('/api/security/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrId, deviceId, deviceName }),
      });
      const data = await res.json();
      return { status: res.status, ok: res.ok, data };
    } catch (e) {
      return { status: 500, ok: false, data: { allowed: true } };
    }
  },

  getAuditLogs: async () => {
    try {
      const res = await fetch('/api/security/audit-logs');
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  toggleWeekendAccess: async ({ targetUserId, weekendAccess, performedBy, reason }) => {
    try {
      const res = await fetch('/api/security/toggle-weekend-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, weekendAccess, performedBy, reason }),
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  resetDevice: async ({ targetUserId, performedBy, reason }) => {
    try {
      const res = await fetch('/api/security/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, performedBy, reason }),
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
