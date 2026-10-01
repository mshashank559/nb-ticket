import React from 'react';
import { Lock, Clock, ShieldAlert, Monitor, ArrowRight, RefreshCw, XCircle } from 'lucide-react';

export function SecurityBlockedModal({
  reason = 'MOBILE_DEVICE_BLOCKED',
  title = 'Desktop Access Required',
  message = 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
  onRetry,
  onClose,
}) {
  const getIcon = () => {
    switch (reason) {
      case 'MOBILE_DEVICE_BLOCKED':
        return (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.2))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.25)',
          }}>
            <Monitor size={32} strokeWidth={2.2} />
          </div>
        );
      case 'BEFORE_WORKING_HOURS':
      case 'AFTER_WORKING_HOURS':
      case 'OUTSIDE_WORKING_HOURS':
        return (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.2))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.25)',
          }}>
            <Clock size={32} strokeWidth={2.2} />
          </div>
        );
      case 'WEEKEND_ACCESS_RESTRICTED':
        return (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.2))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366f1',
            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.25)',
          }}>
            <Lock size={32} strokeWidth={2.2} />
          </div>
        );
      case 'UNAUTHORIZED_DEVICE':
      case 'DEVICE_REVOKED':
      default:
        return (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.2))',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.25)',
          }}>
            <ShieldAlert size={32} strokeWidth={2.2} />
          </div>
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(11, 15, 25, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeInSecurity 0.3s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes fadeInSecurity {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Security Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '9999px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#475569',
            marginBottom: '20px',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
          NetBounce Security Protocol
        </div>

        {/* Dynamic Security Icon */}
        <div style={{ marginBottom: '20px' }}>
          {getIcon()}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 10px 0',
            fontSize: '22px',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#475569',
            fontWeight: 400,
          }}
        >
          {message}
        </p>

        {/* Additional Schedule Context if Working Hours or Weekend */}
        {(reason === 'BEFORE_WORKING_HOURS' || reason === 'AFTER_WORKING_HOURS' || reason === 'WEEKEND_ACCESS_RESTRICTED') && (
          <div
            style={{
              width: '100%',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px',
              textAlign: 'left',
              fontSize: '12px',
              color: '#334155',
            }}
          >
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
              Scheduled Working Hours (IST):
            </div>
            <div>&bull; Monday &ndash; Friday: 7:30 PM to 4:30 AM (Next Day)</div>
            <div>&bull; Weekend (Sat 4:30 AM to Mon 7:30 PM): Process Analyst Authorization Required</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
            >
              <RefreshCw size={14} />
              Re-check Access
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
