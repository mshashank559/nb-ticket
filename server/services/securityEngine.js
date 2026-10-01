// Security Engine for NetBounce Ticketing System
// Enforces:
// 1. Desktop / Laptop Only Access (Blocks mobile devices)
// 2. Working Hours (7:30 PM -> 4:30 AM IST, Mon-Fri) & Weekend Access Control
// 3. Trusted Device Binding & Enrollment (Protocol #3)

const TIMEZONE = 'Asia/Kolkata';

/**
 * Checks if the request comes from a mobile phone or tablet.
 */
export function isMobileDevice(req) {
  if (!req) return false;

  // 1. Check client-side hardware/fingerprint detection headers & payload
  if (req.headers && req.headers['x-client-is-mobile'] === 'true') return true;
  if (req.body && (req.body.isMobile === true || req.body.isClientMobile === true)) return true;

  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const chMobile = req.headers['sec-ch-ua-mobile'];

  // 2. Check Chrome Client Hints
  if (chMobile === '?1') return true;

  // 3. Regex for mobile user agents
  const mobileRegex = /(android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|webos|silk|fennec|windows phone|kindle|opera mobi|mobi)/i;
  if (mobileRegex.test(ua)) return true;

  return false;
}

/**
 * Evaluates the working schedule in Asia/Kolkata timezone.
 * Window: Monday -> Friday, 7:30 PM (19:30) to 4:30 AM (04:30) next morning.
 * Midnight crossing handled explicitly.
 */
export function evaluateWorkingHours() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  });

  const parts = istFormatter.formatToParts(now);
  const partMap = {};
  parts.forEach((p) => { partMap[p.type] = p.value; });

  const weekday = partMap.weekday; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const currentMinutes = hour * 60 + minute;

  const SHIFT_START = 19 * 60 + 30; // 19:30 = 1170 minutes
  const SHIFT_END = 4 * 60 + 30;    // 04:30 = 270 minutes

  // Active shift condition
  let isInsideShift = false;

  if (weekday === 'Mon' && currentMinutes >= SHIFT_START) isInsideShift = true;
  else if (weekday === 'Tue' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
  else if (weekday === 'Wed' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
  else if (weekday === 'Thu' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
  else if (weekday === 'Fri' && (currentMinutes <= SHIFT_END || currentMinutes >= SHIFT_START)) isInsideShift = true;
  else if (weekday === 'Sat' && currentMinutes <= SHIFT_END) isInsideShift = true;

  if (isInsideShift) {
    return {
      allowed: true,
      isWeekend: false,
      currentTimeIST: `${partMap.hour}:${partMap.minute} IST (${weekday})`,
    };
  }

  // Determine if it is Weekend
  // Weekend begins Saturday 04:30 AM and ends Monday 07:30 PM
  const isWeekend =
    (weekday === 'Sat' && currentMinutes > SHIFT_END) ||
    weekday === 'Sun' ||
    (weekday === 'Mon' && currentMinutes < SHIFT_START);

  if (isWeekend) {
    return {
      allowed: false,
      isWeekend: true,
      reason: 'WEEKEND_ACCESS_RESTRICTED',
      title: 'Weekend Access Restricted',
      message: 'Weekend access is currently restricted. Please contact your Process Analyst if you require authorized access.',
      currentTimeIST: `${partMap.hour}:${partMap.minute} IST (${weekday})`,
    };
  }

  // It is a weekday, but outside the 7:30 PM -> 4:30 AM shift
  if (currentMinutes < SHIFT_START && currentMinutes > SHIFT_END) {
    // Between 4:30 AM and 7:30 PM
    if (currentMinutes >= 18 * 60) {
      // 6:00 PM onwards, right before shift
      return {
        allowed: false,
        isWeekend: false,
        reason: 'BEFORE_WORKING_HOURS',
        title: 'Access Opens at 7:30 PM',
        message: 'The NetBounce Ticketing System is currently outside its scheduled working window. Access opens at 7:30 PM.',
        currentTimeIST: `${partMap.hour}:${partMap.minute} IST (${weekday})`,
      };
    }
    return {
      allowed: false,
      isWeekend: false,
      reason: 'AFTER_WORKING_HOURS',
      title: 'Access Window Closed',
      message: 'The NetBounce Ticketing System is currently outside its scheduled access hours. Next access opens at 7:30 PM.',
      currentTimeIST: `${partMap.hour}:${partMap.minute} IST (${weekday})`,
    };
  }

  return {
    allowed: true,
    isWeekend: false,
    currentTimeIST: `${partMap.hour}:${partMap.minute} IST (${weekday})`,
  };
}

/**
 * Complete security gate evaluation for a user session or login attempt.
 */
export function evaluateSecurityAccess({ req, user, deviceId, deviceName, isProcessTeamStation }) {
  // Gate 1: Desktop / Mobile Check
  if (isMobileDevice(req)) {
    return {
      allowed: false,
      reason: 'MOBILE_DEVICE_BLOCKED',
      title: 'Desktop Access Required',
      message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
    };
  }

  // Gate 2: Schedule & Weekend Check
  const schedule = evaluateWorkingHours();
  if (!schedule.allowed) {
    // Process analysts and users with weekend grant can access on weekend
    if (schedule.isWeekend && user && (user.weekendAccess === true || user.role === 'process_analyst')) {
      // Allowed via Process Analyst override
    } else {
      return {
        allowed: false,
        reason: schedule.reason,
        title: schedule.title,
        message: schedule.message,
      };
    }
  }

  // Gate 3: Device Trust / Binding Check (Protocol #3)
  // Process team exemption: Process Team members or designated Process Workstations can log into any user account
  const isProcessTeam = (user && user.role === 'process_analyst') || isProcessTeamStation === true;

  if (!isProcessTeam && user && deviceId) {
    if (user.deviceStatus === 'REVOKED') {
      return {
        allowed: false,
        reason: 'DEVICE_REVOKED',
        title: 'Device Access Revoked',
        message: 'Your device access has been revoked by a security administrator. Please contact your Process Analyst.',
      };
    }

    // If user already has a trusted device registered and it differs from incoming device
    if (user.trustedDeviceId && user.trustedDeviceId.trim() !== '' && user.trustedDeviceId !== deviceId) {
      return {
        allowed: false,
        reason: 'UNAUTHORIZED_DEVICE',
        title: 'Device Not Authorized',
        message: 'This device is not registered for your account. Please log in from your authorized company machine or contact your Process Analyst to reset your device enrollment.',
      };
    }
  }

  return { allowed: true };
}
