import { useCallback, useEffect, useRef } from 'react';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  loadTimesheetData,
  loadGoalAlertLastFired,
  saveGoalAlertLastFired,
} from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import { playGoalAlert } from '../utils/goalAlertSound';

// Seconds tracked for one entry — same rule the Reports view uses: an entry
// with no endTime is still running and counts up to `now`.
const entrySeconds = (entry, nowMs) => {
  if (!entry?.startTime) return 0;
  try {
    const startMs = parseISO(entry.startTime).getTime();
    const endMs = entry.endTime ? parseISO(entry.endTime).getTime() : nowMs;
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  } catch {
    return 0;
  }
};

const formatGoal = (hours) => {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole}h`;
  return whole === 0 ? `${minutes}min` : `${whole}h ${minutes}min`;
};

// Recheck this often regardless of anything else. The precise timer below is
// what actually lands the alert on the second; this only exists to notice the
// things a timer can't — the calendar day rolling over, the machine waking
// from sleep with a long-expired timeout, the system clock moving.
const HEARTBEAT_MS = 60 * 1000;

// Cap on a single scheduled wakeup. A longer wait is re-derived from the data
// when the cap expires rather than resting on one enormous timeout that a
// sleep/wake cycle or a clock change would quietly invalidate.
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Watches today's tracked time and pings once when it reaches the daily hours
 * goal.
 *
 * Mounted once at the app root rather than inside the tracker, because the
 * moment you cross the goal is exactly the moment you're likely looking at
 * something else — the point of a sound is that it reaches you off-screen.
 *
 * HOW THE TIMING WORKS. Polling every second to compare two numbers would burn
 * a wakeup a second all day for an event that happens once. Instead, whenever
 * the data changes we work out *when* the goal will be reached — the running
 * entry's start plus whatever time is still owed — and set a single timeout
 * for that instant. Starting, stopping, editing, or deleting an entry re-runs
 * the sum and re-arms the timer.
 *
 * FIRING ONCE. The day the alert last fired for is persisted (per workspace),
 * so reloading the page at 8h30 doesn't ping you again, and a fresh day
 * re-arms on its own. If the goal is *already* met the first time this runs —
 * you switched the setting on after a long day, or the marker was cleared —
 * the marker is set silently: a chime for something that happened hours ago is
 * noise, not news.
 *
 * @returns {(options?: {persist?: boolean}) => Promise<void>} the same routine
 *   the watcher runs when the goal is crossed, exposed so the dev-host preview
 *   in Settings can exercise the real path (sound, toast, wording) instead of
 *   an imitation of it. `persist: false` skips writing the fired-marker, so a
 *   preview doesn't suppress the genuine alert later that day.
 */
export const useDailyGoalAlert = () => {
  const { selectedTimezone } = useTimezone();
  const { dailyHourGoal, goalAlert } = useUserPreferences();
  const { addToast } = useToast();

  // The day we've already looked at. Until a day has been evaluated once, an
  // already-met goal arms silently rather than chiming (see above). A ref, not
  // state, because changing it must never re-render the whole app.
  const armedForDayRef = useRef(null);

  const fire = useCallback(async ({ persist = true } = {}) => {
    if (persist) {
      saveGoalAlertLastFired(formatInTimeZone(new Date(), selectedTimezone, 'yyyy-MM-dd'));
    }

    // Toast first. The sound can be blocked by the browser's autoplay policy
    // or a muted device, and the message is the part that must always arrive.
    addToast(`Daily goal reached — ${formatGoal(dailyHourGoal)} tracked today.`, 'success', 8000);

    await playGoalAlert({ soundId: goalAlert.soundId, volume: goalAlert.volume });
  }, [addToast, dailyHourGoal, selectedTimezone, goalAlert.soundId, goalAlert.volume]);

  const { enabled, repeatMinutes } = goalAlert;

  useEffect(() => {
    // Timers are effect-local rather than refs: this effect re-runs whenever
    // anything that moves the alert's due time changes, and its cleanup is
    // then the single place that has to cancel them.
    let timeoutId = null;
    let repeatId = null;

    const clearTimers = () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (repeatId) { clearInterval(repeatId); repeatId = null; }
    };

    const todayKeyNow = () => formatInTimeZone(new Date(), selectedTimezone, 'yyyy-MM-dd');

    // Nudge again every N minutes while the clock is still running past the
    // goal, for people who want to know they're into overtime. Never armed by
    // the dev preview — only alongside a real crossing.
    const startRepeat = () => {
      if (repeatId || !repeatMinutes || repeatMinutes <= 0) return;
      repeatId = setInterval(() => {
        const stillRunning = (loadTimesheetData()[todayKeyNow()] || [])
          .some(e => e.isActive || !e.endTime);
        if (!stillRunning) {
          clearInterval(repeatId);
          repeatId = null;
          return;
        }
        fire({ persist: false });
      }, repeatMinutes * 60 * 1000);
    };

    // Declared, not assigned to a const, so the timeout below can call it from
    // inside its own body.
    function evaluate() {
      clearTimers();
      if (!enabled) return;
      if (!Number.isFinite(dailyHourGoal) || dailyHourGoal <= 0) return;

      const nowMs = Date.now();
      const todayKey = formatInTimeZone(new Date(nowMs), selectedTimezone, 'yyyy-MM-dd');
      const goalSeconds = dailyHourGoal * 3600;
      const entries = loadTimesheetData()[todayKey] || [];

      // A new day resets the latch, so a goal already met on some earlier day
      // can never chime.
      if (armedForDayRef.current !== todayKey) {
        armedForDayRef.current = todayKey;
        const total = entries.reduce((sum, entry) => sum + entrySeconds(entry, nowMs), 0);
        if (total >= goalSeconds) {
          saveGoalAlertLastFired(todayKey);
          return;
        }
      }

      if (loadGoalAlertLastFired() === todayKey) {
        // Already chimed today; all that's left is the optional overtime nudge.
        startRepeat();
        return;
      }

      let completedSeconds = 0;
      let runningStartMs = null;
      entries.forEach(entry => {
        if (entry.isActive || !entry.endTime) {
          // Earliest start wins if the data somehow holds two actives — the
          // conservative reading, and it can't make the alert late.
          const startMs = entry.startTime ? parseISO(entry.startTime).getTime() : null;
          if (startMs != null && (runningStartMs == null || startMs < runningStartMs)) {
            runningStartMs = startMs;
          }
        } else {
          completedSeconds += entrySeconds(entry, nowMs);
        }
      });

      const runningSeconds = runningStartMs == null
        ? 0
        : Math.max(0, Math.floor((nowMs - runningStartMs) / 1000));

      if (completedSeconds + runningSeconds >= goalSeconds) {
        fire();
        startRepeat();
        return;
      }

      // Nothing running means nothing will move the total on its own — the
      // next storage change re-runs this.
      if (runningStartMs == null) return;

      const remainingMs = (goalSeconds - completedSeconds - runningSeconds) * 1000;
      // The 250ms cushion lands the wakeup a hair past the boundary rather
      // than a millisecond short of it, which would only re-arm for one more.
      timeoutId = setTimeout(() => {
        timeoutId = null;
        evaluate();
      }, Math.min(remainingMs + 250, MAX_TIMEOUT_MS));
    }

    evaluate();

    const unsubscribe = storageEventSystem.subscribe('kronos_timesheet_data', evaluate);
    const heartbeat = setInterval(evaluate, HEARTBEAT_MS);
    // Timers are throttled or frozen in a background tab, so returning to the
    // page re-checks rather than trusting whatever happened while it was away.
    const onVisible = () => { if (!document.hidden) evaluate(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimers();
    };
  }, [fire, enabled, repeatMinutes, dailyHourGoal, selectedTimezone]);

  return fire;
};

export default useDailyGoalAlert;
