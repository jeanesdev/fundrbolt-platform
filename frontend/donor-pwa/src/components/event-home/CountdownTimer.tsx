/**
 * CountdownTimer Component
 *
 * Displays a real-time countdown to an event date.
 * Features:
 * - Days, hours, minutes, seconds display
 * - Emphasized styling when within 24 hours
 * - Urgent styling when within 1 hour
 * - Automatic hide when expired
 * - Event-branded colors via CSS variables
 */

import { useCountdown } from '@/hooks/use-countdown';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export interface CountdownTimerProps {
  /** Target date/time to count down to (ISO string or Date) */
  targetDate: string | Date | null | undefined;
  /** Event name for context */
  eventName?: string;
  /** Whether to hide when countdown expires (default: true) */
  hideOnExpire?: boolean;
  /** Optional callback when countdown expires */
  onExpire?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TimeUnit - Individual time unit display
 */
function TimeUnit({
  value,
  label,
  emphasized,
}: {
  value: number;
  label: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={cn(
          'font-bold tabular-nums transition-all duration-300',
          emphasized ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'
        )}
        style={{ color: 'var(--event-card-text, #000000)' }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span
        className={cn(
          'uppercase tracking-wider transition-all duration-300',
          emphasized ? 'text-sm' : 'text-xs'
        )}
        style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Separator between time units
 */
function Separator({ emphasized }: { emphasized?: boolean }) {
  return (
    <span
      className={cn(
        'font-bold transition-all duration-300',
        emphasized ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'
      )}
      style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
    >
      :
    </span>
  );
}

/**
 * CountdownTimer component
 */
export function CountdownTimer({
  targetDate,
  eventName,
  hideOnExpire = true,
  onExpire,
  className,
}: CountdownTimerProps) {
  const countdown = useCountdown(targetDate, { onExpire });

  // Hide if expired and hideOnExpire is true
  if (countdown.isExpired && hideOnExpire) {
    return null;
  }

  const { days, hours, minutes, seconds, isWithin24Hours, isWithin1Hour, isExpired } =
    countdown;

  // Show urgent styling when within 1 hour
  const isUrgent = isWithin1Hour && !isExpired;
  // Show emphasized styling when within 24 hours
  const isEmphasized = isWithin24Hours && !isExpired;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 sm:p-6 transition-all duration-300',
        isUrgent && 'border-red-500/50 bg-red-500/5 animate-pulse',
        isEmphasized && !isUrgent && 'scale-[1.02]',
        className
      )}
      style={{
        backgroundColor: isUrgent ? undefined : 'rgb(var(--event-card-bg, 147, 51, 234))',
        borderColor: isEmphasized && !isUrgent
          ? 'rgb(var(--event-primary, 59, 130, 246))'
          : isUrgent
            ? undefined
            : 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Clock
          className={cn(
            'transition-all duration-300',
            isEmphasized ? 'h-5 w-5' : 'h-4 w-4'
          )}
          style={{ color: 'var(--event-card-text, #000000)' }}
        />
        <span
          className={cn(
            'font-medium transition-all duration-300',
            isEmphasized ? 'text-base' : 'text-sm',
            isUrgent && 'text-red-600'
          )}
          style={{
            color: isUrgent ? undefined : 'var(--event-card-text, #000000)',
          }}
        >
          {isExpired
            ? 'Event has started!'
            : isUrgent
              ? 'Starting very soon!'
              : isEmphasized
                ? 'Starting soon!'
                : eventName
                  ? `Countdown to ${eventName}`
                  : 'Event Countdown'}
        </span>
      </div>

      {/* Countdown display */}
      {!isExpired && (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {days > 0 && (
            <>
              <TimeUnit value={days} label="Days" emphasized={isEmphasized} />
              <Separator emphasized={isEmphasized} />
            </>
          )}
          <TimeUnit value={hours} label="Hours" emphasized={isEmphasized} />
          <Separator emphasized={isEmphasized} />
          <TimeUnit value={minutes} label="Mins" emphasized={isEmphasized} />
          <Separator emphasized={isEmphasized} />
          <TimeUnit value={seconds} label="Secs" emphasized={isEmphasized} />
        </div>
      )}

      {/* Expired message */}
      {isExpired && !hideOnExpire && (
        <div className="text-center">
          <span
            className="text-xl font-bold"
            style={{ color: 'var(--event-card-text, #000000)' }}
          >
            The event has begun!
          </span>
        </div>
      )}
    </div>
  );
}

export default CountdownTimer;
