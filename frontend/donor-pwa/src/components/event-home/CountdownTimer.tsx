/**
 * CountdownTimer Component — Redesigned (Premium Native App)
 *
 * Dramatic, large countdown with animated digit transitions.
 * Uses event brand gradient background.
 */

import { useCountdown } from '@/hooks/use-countdown';
import { cn } from '@/lib/utils';

export interface CountdownTimerProps {
  targetDate: string | Date | null | undefined;
  eventName?: string;
  hideOnExpire?: boolean;
  onExpire?: () => void;
  className?: string;
}

/**
 * Single animated digit block
 */
function DigitBlock({
  value,
  label,
  urgent,
}: {
  value: number;
  label: string;
  urgent?: boolean;
}) {
  const displayValue = String(value).padStart(2, '0');

  return (
    <div className='flex flex-col items-center gap-1'>
      <div
        className={cn(
          'relative flex h-16 w-16 items-center justify-center rounded-2xl sm:h-20 sm:w-20',
          'shadow-lg backdrop-blur-sm border',
          urgent ? 'border-red-200/70 bg-black/35' : 'border-white/30 bg-black/35'
        )}
      >
        <span
          key={displayValue}
          className='font-black tabular-nums text-white text-3xl sm:text-4xl leading-none'
        >
          {displayValue}
        </span>
      </div>
      <span className='text-[10px] font-semibold uppercase tracking-widest text-white/85'>
        {label}
      </span>
    </div>
  );
}

function Dot({ urgent }: { urgent?: boolean }) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'pb-7 text-xl font-black leading-none sm:text-2xl',
        urgent ? 'text-red-200/80' : 'text-white/65'
      )}
    >
      :
    </span>
  );
}

export function CountdownTimer({
  targetDate,
  eventName,
  hideOnExpire = true,
  onExpire,
  className,
}: CountdownTimerProps) {
  const countdown = useCountdown(targetDate, { onExpire });

  if (countdown.isExpired && hideOnExpire) return null;

  const { days, hours, minutes, seconds, isWithin1Hour, isExpired } = countdown;
  const urgent = isWithin1Hour && !isExpired;

  const label = isExpired
    ? 'Event is live'
    : urgent
      ? '⚡ Starting very soon!'
      : eventName
        ? `Countdown to ${eventName}`
        : 'Event Countdown';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 sm:p-6',
        urgent && 'animate-pulse',
        className
      )}
      style={{
        background: urgent
          ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
          : `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.9) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.9) 100%)`,
      }}
    >
      {/* Contrast scrim */}
      <div className='pointer-events-none absolute inset-0 bg-black/35' />

      {/* Decorative blur circles */}
      <div className='pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5 blur-2xl' />
      <div className='pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/5 blur-2xl' />

      <div className='relative z-10'>
        <p className='mb-4 text-center text-xs font-semibold uppercase tracking-widest text-white'>
          {label}
        </p>

        {!isExpired ? (
          <div className='flex items-end justify-center gap-2 sm:gap-3'>
            {days > 0 && (
              <>
                <DigitBlock value={days} label='Days' urgent={urgent} />
                <Dot urgent={urgent} />
              </>
            )}
            <DigitBlock value={hours} label='Hours' urgent={urgent} />
            <Dot urgent={urgent} />
            <DigitBlock value={minutes} label='Mins' urgent={urgent} />
            <Dot urgent={urgent} />
            <DigitBlock value={seconds} label='Secs' urgent={urgent} />
          </div>
        ) : (
          <p className='text-center text-2xl font-black text-white'>
            Live now
          </p>
        )}
      </div>
    </div>
  );
}

export default CountdownTimer;
