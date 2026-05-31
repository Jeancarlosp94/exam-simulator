import { useCallback, useEffect, useRef, useState } from "react";

type UseTimerOptions = {
  initialSeconds: number;
  onFinish?: (secondsRemainingAtFinish: number) => void;
};

type UseTimerResult = {
  timeLeft: number;
  stop: () => void;
  initialSeconds: number;
};

/**
 * Countdown timer that ticks once per second.
 *
 * `initialSeconds` is captured on mount, like `useState`'s initial value.
 * To restart the timer with a different duration, remount the consumer
 * with a fresh React `key`. This makes the hook idempotent and avoids the
 * mid-flight reset bug the legacy CACES timer had.
 *
 * `onFinish(0)` fires when the countdown reaches zero. The callback is
 * held in a ref so changing its identity does not restart the interval.
 *
 * Caveat: backgrounded tabs throttle `setInterval`. For exam-grade
 * precision, the caller should reconcile elapsed time from a stored
 * start timestamp on submit.
 */
export function useTimer({
  initialSeconds,
  onFinish,
}: UseTimerOptions): UseTimerResult {
  const [initial] = useState(initialSeconds);
  const [timeLeft, setTimeLeft] = useState(initial);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(onFinish);

  useEffect(() => {
    callbackRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (initial <= 0) {
      callbackRef.current?.(0);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          callbackRef.current?.(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [initial]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { timeLeft, stop, initialSeconds: initial };
}
