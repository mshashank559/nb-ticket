// Client-side Security Service for NetBounce Ticketing System
// Enforces Desktop-only, Shift timing, Weekend restriction, and Trusted Device Enrollment

const DEVICE_ID_KEY = 'netbounce_device_token_v1';
const PROCESS_STATION_KEY = 'netbounce_is_process_station';

/**
 * Checks whether this browser has been verified as a Process Team Workstation.
 */
export function isProcessTeamStation() {
  try {
    return localStorage.getItem(PROCESS_STATION_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Designates or un-designates this browser as a Process Team Workstation.
 */
export function markProcessTeamStation(enabled = true) {
  try {
    if (enabled) {
      localStorage.setItem(PROCESS_STATION_KEY, 'true');
    } else {
      localStorage.removeItem(PROCESS_STATION_KEY);
    }
  } catch (e) {}
}

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
 * Strictly checks if the client device is a mobile phone or tablet,
 * including when the user enables "Desktop site" / "Desktop view" on their mobile browser.
 */
export function isClientMobile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // 1. Client Hints API (Standard Mobile View)
  if (navigator.userAgentData && navigator.userAgentData.mobile === true) {
    return true;
  }

  // 2. Direct User Agent Mobile Regex (Catches Android, iPhone, iPad, etc.)
  const mobileRegex = /(android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|webos|silk|fennec|windows phone|kindle|opera mobi|mobi)/i;
  if (mobileRegex.test(ua)) {
    return true;
  }

  // 3. iOS (iPhone / iPad) in Desktop View (Safari / Chrome iOS spoofs Macintosh / MacIntel)
  // Real Macs NEVER have touchscreens (maxTouchPoints is always 0 on genuine Macs)
  const isAppleTouch = (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os x')) &&
    Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  if (isAppleTouch) {
    return true;
  }

  // 4. Physical Screen Dimensions Check (Immune to Desktop Site zoom / virtual viewport)
  // Even when a mobile browser sets viewport to 980px or 1024px in desktop mode,
  // the physical screen dimensions remain small (e.g. 360-430px wide).
  // Standard laptops and desktops have minimum screen dimension >= 700px (1366x768 -> 768px, 1080p -> 1080px).
  const screenWidth = window.screen ? window.screen.width : 0;
  const screenHeight = window.screen ? window.screen.height : 0;
  const availWidth = window.screen ? window.screen.availWidth : 0;
  const availHeight = window.screen ? window.screen.availHeight : 0;
  const minScreenDim = Math.min(
    screenWidth || 9999,
    screenHeight || 9999,
    availWidth || 9999,
    availHeight || 9999
  );

  const hasTouch = Boolean(
    'ontouchstart' in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
  );

  // If the device has touch and its physical screen smaller dimension is < 650px, it is definitely a phone
  if (hasTouch && minScreenDim < 650) {
    return true;
  }

  // 5. Coarse Pointer & No Hover Check (Standard Touchscreen Phone profile)
  try {
    const hasCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasNoHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (hasCoarsePointer && hasNoHover && minScreenDim < 820) {
      return true;
    }
  } catch (e) {}

  // 6. Hardware Vibration API (Exclusive to Smartphones; not supported on PC/Mac laptops)
  if (typeof navigator.vibrate === 'function' && hasTouch && minScreenDim < 820) {
    return true;
  }

  // 7. WebGL GPU Hardware Unmasked Renderer Check (Detects Qualcomm Adreno, ARM Mali, PowerVR)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        // If it has a mobile GPU chipset and touch capability, it's a mobile device
        if (/(adreno|mali|powervr|apple gpu|vivante)/i.test(renderer) && hasTouch) {
          return true;
        }
      }
    }
  } catch (e) {}

  // 8. Viewport size fallback for small screens
  if (hasTouch && window.innerWidth < 820 && minScreenDim < 820) {
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
  verifyAccess: async ({ emailOrId, deviceId, deviceName, isProcessTeamStation: forceStation }) => {
    try {
      const isStation = forceStation !== undefined ? forceStation : isProcessTeamStation();
      const isMobile = isClientMobile();
      const res = await fetch('/api/security/verify-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-is-mobile': isMobile ? 'true' : 'false',
        },
        body: JSON.stringify({
          emailOrId,
          deviceId,
          deviceName,
          isProcessTeamStation: isStation,
          isMobile,
        }),
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
