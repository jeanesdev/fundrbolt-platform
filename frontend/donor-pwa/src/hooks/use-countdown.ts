/**
 * useCountdown Hook
 *
 * Calculates and returns a live countdown to a target date.
 * Updates every second and handles cleanup properly.
 *
 * @param targetDate - The date/time to count down to
 * @returns Countdown values (days, hours, minutes, seconds) and state flags
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds remaining */
  totalMs: number;
  /** Whether the countdown has expired (reached zero) */
  isExpired: boolean;
  /** Whether the event is within 24 hours (for emphasized styling) */
  isWithin24Hours: boolean;
  /** Whether the event is within 1 hour (for urgent styling) */
  isWithin1Hour: boolean;
}

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

/**
 * Calculate countdown values from milliseconds remaining
 */
function calculateCountdown(targetTime: number): CountdownValues {
  const now = Date.now();
  const totalMs = Math.max(0, targetTime - now);
  const isExpired = totalMs <= 0;

  if (isExpired) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isExpired: true,
      isWithin24Hours: false,
      isWithin1Hour: false,
    };
  }

  const days = Math.floor(totalMs / DAY);
  const hours = Math.floor((totalMs % DAY) / HOUR);
  const minutes = Math.floor((totalMs % HOUR) / MINUTE);
  const seconds = Math.floor((totalMs % MINUTE) / SECOND);

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs,
    isExpired: false,
    isWithin24Hours: totalMs <= DAY,
    isWithin1Hour: totalMs <= HOUR,
  };
}

/**
 * useCountdown hook
 *
 * @param targetDate - ISO date string or Date object to count down to
 * @param options - Configuration options
 * @returns CountdownValues with live updates
 *
 * @example
 * ```tsx
 * const countdown = useCountdown('2024-12-31T23:59:59Z');
 * if (!countdown.isExpired) {
 *   return <span>{countdown.days}d {countdown.hours}h</span>;
 * }
 * ```
 */
export function useCountdown(
  targetDate: string | Date | null | undefined,
  options?: {
    /** Update interval in ms (default: 1000) */
    updateInterval?: number;
    /** Callback when countdown expires */
    onExpire?: () => void;
  }
): CountdownValues {
  const { updateInterval = 1000, onExpire } = options || {};

  // Memoize target timestamp
  const targetTime = useMemo(() => {
    if (!targetDate) return 0;
    const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    return date.getTime();
  }, [targetDate]);

  // Initialize state
  const [countdown, setCountdown] = useState<CountdownValues>(() =>
    calculateCountdown(targetTime)
  );

  // Update callback
  const updateCountdown = useCallback(() => {
    const newCountdown = calculateCountdown(targetTime);
    setCountdown((prev) => {
      // Only trigger onExpire once when transitioning to expired
      if (!prev.isExpired && newCountdown.isExpired && onExpire) {
        onExpire();
      }
      return newCountdown;
    });
  }, [targetTime, onExpire]);

  // Setup interval
  useEffect(() => {
    // Don't start timer if no target date or already expired
    if (!targetTime || countdown.isExpired) {
      return;
    }

    // Update immediately
    updateCountdown();

    // Start interval
    const intervalId = setInterval(updateCountdown, updateInterval);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [targetTime, updateInterval, updateCountdown, countdown.isExpired]);

  // Recalculate when targetDate changes
  useEffect(() => {
    setCountdown(calculateCountdown(targetTime));
  }, [targetTime]);

  return countdown;
}

export default useCountdown;
