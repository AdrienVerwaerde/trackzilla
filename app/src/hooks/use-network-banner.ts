import { useEffect, useState } from 'react';

import { useNetworkStore } from '@/stores/network-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { formatClock } from '@/utils/format';

/**
 * The three states of the brief. `online` is never rendered: fresh data needs
 * no explanation, and a bar that is always there stops being read.
 */
export type BannerState = 'online' | 'offline' | 'reconnecting';

export type Banner = {
  state: Exclude<BannerState, 'online'>;
  label: string;
};

/** Whole seconds between `now` and `at`, never negative. */
const secondsUntil = (at: number, now: number) => Math.max(0, Math.ceil((at - now) / 1000));

/**
 * Seconds left before the scheduled attempt, refreshed every second.
 *
 * The clock is held in state rather than read while rendering. Reading it at
 * render time looks like a pure function of `at`, and the React Compiler
 * memoises it on that basis: the countdown then freezes on its first value
 * however often the component re-renders.
 *
 * `at` changing means a new attempt was just scheduled, so the stored clock is
 * stale by up to one tick and would show a figure counting down to the
 * *previous* attempt. Resetting it in the same render — React's documented way
 * to react to a changed input without an effect — starts the count from now.
 */
function useCountdown(at: number | null) {
  // Null until a timer has reported a clock for *this* attempt. The clock is
  // never read while rendering: that is an impure render, and it is precisely
  // what let the compiler memoise this on its first value.
  const [now, setNow] = useState<number | null>(null);
  const [scheduled, setScheduled] = useState(at);

  if (scheduled !== at) {
    setScheduled(at);
    setNow(null);
  }

  useEffect(() => {
    if (at === null) return;

    const readClock = () => setNow(Date.now());
    // From timer callbacks only — setState straight in an effect body is out
    // too. The immediate one fills in the first figure within a frame, instead
    // of leaving the bar numberless for a whole second.
    const first = setTimeout(readClock, 0);
    const ticking = setInterval(readClock, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(ticking);
    };
  }, [at]);

  return at === null || now === null ? null : secondsUntil(at, now);
}

/**
 * Decides what the banner says, from the two sources that disagree on purpose.
 *
 * NetInfo is the fast signal and explains *why* nothing is arriving: with no
 * usable network there is no point promising a retry. The socket is the only
 * thing that can claim the app is online, so an open socket wins over anything
 * NetInfo believes — and a closed one means the bar stays up even while the
 * phone insists it has five bars of Wi-Fi.
 *
 * Returns null when there is nothing honest to say: online, or in the
 * background where the socket is closed on purpose and nobody is looking.
 */
export function useNetworkBanner(): Banner | null {
  const connection = useTelemetryStore((state) => state.connection);
  const nextAttemptAt = useTelemetryStore((state) => state.nextAttemptAt);
  const lastTs = useTelemetryStore((state) => state.last?.ts ?? null);
  const reachable = useNetworkStore((state) => state.reachable);

  const seconds = useCountdown(nextAttemptAt);

  if (connection === 'open' || connection === 'idle') return null;

  // `null` is "NetInfo has not answered yet", which is not a reason to claim
  // the phone is cut off: only an explicit false is.
  if (reachable === false) {
    const since = lastTs === null ? '' : ` · dernières données à ${formatClock(lastTs * 1000)}`;
    return { state: 'offline', label: `Hors ligne${since}` };
  }

  if (connection === 'lost') {
    const delay = seconds === null ? '' : ` · prochaine tentative dans ${seconds} s`;
    return { state: 'reconnecting', label: `Reconnexion${delay}` };
  }

  return { state: 'reconnecting', label: 'Connexion au backend…' };
}
