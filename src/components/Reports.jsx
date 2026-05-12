import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Flame, Target, TrendingUp, BarChart3, ListChecks } from 'lucide-react';
import { loadTimesheetData } from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const RANGES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
];

// Seconds tracked for one entry. Active entries (no endTime) count up to `now`
// so today's totals stay live; past-day actives are rare in practice (the v1
// reliability work auto-closes stale ones on load), and counting them as
// now-startTime is the same approximation the rest of the app uses.
const entrySeconds = (entry, now) => {
  if (!entry?.startTime) return 0;
  try {
    const startMs = parseISO(entry.startTime).getTime();
    const endMs = entry.endTime ? parseISO(entry.endTime).getTime() : now.getTime();
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  } catch {
    return 0;
  }
};

const dayKey = (date, timezone) => formatInTimeZone(date, timezone, 'yyyy-MM-dd');

// Day-of-week (0=Sun..6=Sat) for a yyyy-MM-dd calendar date — independent of
// the runtime locale/timezone since calendar dates aren't timezone-shifted.
const dowFromKey = (yyyymmdd) => {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Shift a yyyy-MM-dd key by N calendar days. Uses UTC math to avoid local-tz
// drift across DST boundaries when we're just walking the calendar grid.
const shiftKey = (yyyymmdd, n) => {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(date.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
};

// Local Date for a yyyy-MM-dd key, used only for `format()` display (weekday
// labels, tooltip dates) — no timezone semantics intended.
const dateFromKey = (yyyymmdd) => {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Days between two yyyy-MM-dd keys (k2 - k1) via UTC math, DST-safe.
const daysBetweenKeys = (k1, k2) => {
  const [y1, m1, d1] = k1.split('-').map(Number);
  const [y2, m2, d2] = k2.split('-').map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
};

// Inline style for a heatmap cell. Buckets are tied to the daily hour goal
// so the colors mean "how close did I get to my target today" rather than
// "vs the busiest day in the range" (which would penalize consistent days).
const getHeatmapStyle = (hours, goal, heatmapColors) => {
  if (!Number.isFinite(hours) || hours <= 0) return { backgroundColor: heatmapColors.emptyColor };
  if (!Number.isFinite(goal) || goal <= 0) return { backgroundColor: heatmapColors.completionColor };
  const pct = (hours / goal) * 100;
  if (pct >= 100) return { backgroundColor: heatmapColors.completionColor };
  const stop = heatmapColors.stops.find(s => pct <= s.upTo);
  return { backgroundColor: stop ? stop.color : heatmapColors.completionColor };
};

const Reports = () => {
  const { selectedTimezone: timezone, isInitialized: timezoneInitialized } = useTimezone();
  const { dailyHourGoal, weekStart, weekendDays, heatmapColors } = useUserPreferences();
  const [range, setRange] = useState('week');
  const [timesheet, setTimesheet] = useState(() => loadTimesheetData());
  const [now, setNow] = useState(() => new Date());
  const [tooltip, setTooltip] = useState(null);
  const [heatmapCardWidth, setHeatmapCardWidth] = useState(0);
  const heatmapAreaRef = useRef(null);
  const heatmapCardRef = useRef(null);

  // Tick once a minute so the goal ring + active-day totals stay fresh while
  // the user lingers on this view.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reload when daily-tracker data is written (e.g. user starts/stops a timer
  // in another tab, or the active timer auto-saves).
  useEffect(() => {
    const unsubscribe = storageEventSystem.subscribe('kronos_timesheet_data', () => {
      setTimesheet(loadTimesheetData());
    });
    return unsubscribe;
  }, []);

  // Measure the heatmap card so we can fit as many prior weeks as the
  // viewport allows. The card itself is always mounted (it also hosts the
  // week-view bar chart), so the observer survives range changes.
  useEffect(() => {
    const el = heatmapCardRef.current;
    if (!el) return;
    setHeatmapCardWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') setHeatmapCardWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const todayKey = useMemo(
    () => (timezoneInitialized && timezone ? dayKey(now, timezone) : null),
    [now, timezone, timezoneInitialized]
  );

  // The "current period" for the selected range. Week stays a rolling 7-day
  // window (no calendar concept); month/quarter snap to the calendar month /
  // calendar quarter containing today so the heatmap can show the full period
  // (including future days) plus surrounding past context.
  //   - startKey/endKey   : current period bounds (full-opacity cells)
  //   - pastStartKey      : first day of the previous full period — the
  //                         heatmap renders everything from here forward so
  //                         the user sees the whole prior period dimmed on
  //                         the left, not just a one-week sliver
  //   - periodEndKey      : clamps stats and the "inRange" status to <= today
  const periodInfo = useMemo(() => {
    if (!todayKey) return null;
    if (range === 'week') {
      return {
        type: 'rolling',
        startKey: shiftKey(todayKey, -6),
        endKey: todayKey,
        periodEndKey: todayKey,
      };
    }
    const [y, m] = todayKey.split('-').map(Number);
    const startMonth = range === 'month' ? m : Math.floor((m - 1) / 3) * 3 + 1;
    const endMonth = range === 'month' ? m : startMonth + 2;
    const lastDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
    const monthsBack = range === 'month' ? 1 : 3;
    const pastStartDate = new Date(Date.UTC(y, startMonth - 1 - monthsBack, 1));
    const pastY = pastStartDate.getUTCFullYear();
    const pastM = pastStartDate.getUTCMonth() + 1;
    return {
      type: 'calendar',
      startKey: `${y}-${String(startMonth).padStart(2, '0')}-01`,
      endKey: `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      pastStartKey: `${pastY}-${String(pastM).padStart(2, '0')}-01`,
      periodEndKey: todayKey,
    };
  }, [todayKey, range]);

  // In-period days from period start to today (inclusive). Drives the week bar
  // chart, range stats, and task breakdown — all "this period so far".
  const dailySeries = useMemo(() => {
    if (!periodInfo) return [];
    const days = [];
    let cursor = periodInfo.startKey;
    while (cursor <= periodInfo.periodEndKey) {
      const entries = timesheet[cursor] || [];
      const seconds = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
      days.push({
        key: cursor,
        date: dateFromKey(cursor),
        seconds,
        hours: seconds / 3600,
      });
      cursor = shiftKey(cursor, 1);
    }
    return days;
  }, [periodInfo, timesheet, now]);

  // Heatmap layout for month/quarter. The grid ALWAYS ends at the last day of
  // the current period (week-aligned), then walks backward by full weeks to
  // fill whatever horizontal space the card has — clamped to a minimum of
  // (prior full period + current full period) so narrow viewports still show
  // useful past context. Cells are tagged so the renderer can dim the
  // surround:
  //   - 'past'    — any day before the current period. Real data, dimmed.
  //   - 'inRange' — current period, day on or before today. Real, full op.
  //   - 'future'  — current period after today, or trailing pad. Empty, dim.
  const heatmapData = useMemo(() => {
    if (range === 'week' || !periodInfo || periodInfo.type !== 'calendar') return null;
    const weekStartsOn = weekStart === 'monday' ? 1 : 0;

    // Pixel sizing of one week column. Tailwind w-6 = 24px, w-3.5 = 14px;
    // gap-1 between columns adds 4px. Card has p-4 (32px total) + a label
    // column (cell-sized) + gap-2 (8px) between label and grid.
    const cellPx = range === 'month' ? 24 : 14;
    const colPx = cellPx + 4;
    const reservedPx = 32 /* p-4 */ + cellPx + 8 /* label col + gap */;
    const availablePx = Math.max(0, heatmapCardWidth - reservedPx);
    const weeksThatFit = Math.floor(availablePx / colPx);

    // Anchor the right edge to a week-end-aligned cell past the current
    // period end, then derive everything else by walking back.
    const endDow = dowFromKey(periodInfo.endKey);
    const trailing = (weekStartsOn + 6 - endDow + 7) % 7;
    const lastGridKey = shiftKey(periodInfo.endKey, trailing);

    // Floor: prior full period + current full period + alignment pads.
    const pastStartDow = dowFromKey(periodInfo.pastStartKey);
    const minLeading = (pastStartDow - weekStartsOn + 7) % 7;
    const minFirstKey = shiftKey(periodInfo.pastStartKey, -minLeading);
    const minWeeks = Math.ceil((daysBetweenKeys(minFirstKey, lastGridKey) + 1) / 7);

    const totalWeeks = Math.max(minWeeks, weeksThatFit);
    const firstGridKey = shiftKey(lastGridKey, -(totalWeeks * 7 - 1));

    const cells = [];
    let cursor = firstGridKey;
    while (cursor <= lastGridKey) {
      let seconds;
      let status;
      if (cursor > periodInfo.periodEndKey) {
        seconds = 0;
        status = 'future';
      } else if (cursor >= periodInfo.startKey) {
        const entries = timesheet[cursor] || [];
        seconds = entries.reduce((s, e) => s + entrySeconds(e, now), 0);
        status = 'inRange';
      } else {
        const entries = timesheet[cursor] || [];
        seconds = entries.reduce((s, e) => s + entrySeconds(e, now), 0);
        status = 'past';
      }
      cells.push({
        key: cursor,
        date: dateFromKey(cursor),
        seconds,
        hours: seconds / 3600,
        status,
      });
      cursor = shiftKey(cursor, 1);
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return { weeks, weekStartsOn };
  }, [periodInfo, range, weekStart, timesheet, now, heatmapCardWidth]);

  // Sun-first weeks visibly label M / W / F (indices 1, 3, 5). Mon-first weeks
  // shift that pattern to indices 0, 2, 4, 6 → M / W / F / S, so the labels
  // line up with the same physical weekdays regardless of week-start setting.
  const weekdayLabels = useMemo(() => {
    const labels = weekStart === 'monday'
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const visible = weekStart === 'monday'
      ? new Set([0, 2, 4, 6])
      : new Set([1, 3, 5]);
    return labels.map((label, idx) => (visible.has(idx) ? label : ''));
  }, [weekStart]);

  const maxHours = Math.max(0.5, ...dailySeries.map(d => d.hours));
  const totalSeconds = dailySeries.reduce((s, d) => s + d.seconds, 0);
  const totalHours = totalSeconds / 3600;
  const avgPerDay = dailySeries.length > 0 ? totalHours / dailySeries.length : 0;

  // Today only — used by the goal ring card.
  const todayHours = useMemo(() => {
    if (!todayKey) return 0;
    const entries = timesheet[todayKey] || [];
    return entries.reduce((s, e) => s + entrySeconds(e, now), 0) / 3600;
  }, [timesheet, todayKey, now]);

  // Walk back from today counting consecutive days with tracked time. Today is
  // allowed to be 0 (in-progress) so a streak from yesterday isn't reset just
  // because the user hasn't started yet today. Non-work days behave like this:
  //   - worked   → +1 (the seconds > 0 branch fires regardless of dow)
  //   - skipped  → +0, but the streak doesn't break either
  // So Sunday-no-work doesn't add, Sunday-with-work does.
  const streak = useMemo(() => {
    if (!todayKey) return 0;
    const weekendSet = new Set(weekendDays);
    let count = 0;
    let cursor = now;
    let allowZeroToday = true;
    for (let i = 0; i < 366; i++) {
      const key = dayKey(cursor, timezone);
      const dow = dowFromKey(key);
      const entries = timesheet[key] || [];
      const seconds = entries.reduce((s, e) => s + entrySeconds(e, now), 0);
      if (seconds > 0) {
        count++;
        cursor = subDays(cursor, 1);
        allowZeroToday = false;
      } else if (i === 0 && allowZeroToday) {
        cursor = subDays(cursor, 1);
        allowZeroToday = false;
      } else if (weekendSet.has(dow)) {
        // Non-work day with no tracked time — skip without counting or breaking.
        cursor = subDays(cursor, 1);
      } else {
        break;
      }
    }
    return count;
  }, [timesheet, now, timezone, todayKey, weekendDays]);

  // Time-by-task breakdown over the full range.
  const taskBreakdown = useMemo(() => {
    const acc = new Map();
    dailySeries.forEach(d => {
      const entries = timesheet[d.key] || [];
      entries.forEach(e => {
        const seconds = entrySeconds(e, now);
        if (seconds === 0) return;
        const name = (e.description || '').trim() || '(untitled)';
        acc.set(name, (acc.get(name) || 0) + seconds);
      });
    });
    const items = Array.from(acc.entries())
      .map(([task, seconds]) => ({ task, seconds, hours: seconds / 3600 }))
      .sort((a, b) => b.seconds - a.seconds);
    const total = items.reduce((s, it) => s + it.seconds, 0);
    return { items, total };
  }, [dailySeries, timesheet, now]);

  // Goal ring geometry.
  const goalProgress = dailyHourGoal > 0 ? Math.min(1, todayHours / dailyHourGoal) : 0;
  const ringSize = 80;
  const ringRadius = 32;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - goalProgress);

  if (!timezoneInitialized) {
    return (
      <div className="p-6 text-sm text-gray-500">Loading reports…</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500">Time tracked over the selected range.</p>
        </div>
        <div role="tablist" aria-label="Range" className="inline-flex bg-gray-100 rounded-lg p-1">
          {RANGES.map(r => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                range === r.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 text-orange-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-500">Current streak</div>
            <div className="text-2xl font-semibold text-gray-900">
              {streak}
              <span className="text-sm font-normal text-gray-500">
                {' '}{streak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className="text-xs text-gray-500">Consecutive days you tracked time.</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={goalProgress >= 1 ? '#16a34a' : '#2563eb'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke-dashoffset 400ms ease, stroke 200ms ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-900">
              {Math.round(goalProgress * 100)}%
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> Today's goal
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {todayHours.toFixed(1)}h
              <span className="text-sm font-normal text-gray-500">
                {' '}/ {dailyHourGoal}h
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {goalProgress >= 1
                ? 'Goal hit — nice work.'
                : `${Math.max(0, dailyHourGoal - todayHours).toFixed(1)}h to go`}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-500">Range total</div>
            <div className="text-2xl font-semibold text-gray-900">{totalHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-500">{avgPerDay.toFixed(1)}h average per day</div>
          </div>
        </div>
      </div>

      <div ref={heatmapCardRef} className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            {range === 'week' ? 'Daily hours' : 'Activity heatmap'}
          </h3>
        </div>

        {range === 'week' && totalSeconds === 0 ? (
          <div className="text-sm text-gray-500 py-12 text-center">
            No tracked time in this range yet.
          </div>
        ) : range === 'week' ? (
          <div
            className="flex items-end gap-1 h-48"
            role="img"
            aria-label="Daily hours bar chart"
          >
            {dailySeries.map(b => {
              const heightPct = maxHours > 0 ? (b.hours / maxHours) * 100 : 0;
              const isToday = b.key === todayKey;
              return (
                <div
                  key={b.key}
                  className="flex-1 h-full flex flex-col items-center gap-1 min-w-0"
                >
                  <div
                    className="text-[10px] text-gray-700 font-medium"
                    style={{ visibility: b.hours > 0 ? 'visible' : 'hidden' }}
                  >
                    {b.hours.toFixed(1)}
                  </div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        isToday ? 'bg-blue-600' : 'bg-blue-400'
                      }`}
                      style={{
                        height: `${b.hours > 0 ? Math.max(heightPct, 2) : 0}%`,
                      }}
                      title={`${format(b.date, 'EEE MMM d')}: ${b.hours.toFixed(2)}h`}
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 truncate w-full text-center">
                    {format(b.date, 'EEE')}
                  </div>
                </div>
              );
            })}
          </div>
        ) : heatmapData ? (
          (() => {
            const isMonth = range === 'month';
            const cellSize = isMonth ? 'w-6 h-6' : 'w-3.5 h-3.5';
            const labelSize = isMonth ? 'h-6' : 'h-3.5';

            const handleCellEnter = (e, cell) => {
              const container = heatmapAreaRef.current;
              if (!container) return;
              const cellRect = e.currentTarget.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const hoursLabel = cell.status === 'future'
                ? 'No data yet'
                : `${(cell.hours || 0).toFixed(2)}h tracked`;
              setTooltip({
                left: cellRect.left - containerRect.left + cellRect.width / 2,
                top: cellRect.top - containerRect.top,
                hoursLabel,
                dateLabel: format(cell.date, 'EEE, MMM d, yyyy'),
              });
            };

            return (
              <div
                ref={heatmapAreaRef}
                className="relative"
                role="img"
                aria-label="Daily activity heatmap"
              >
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <div className="flex flex-col gap-1 text-[10px] text-gray-500 shrink-0">
                    {weekdayLabels.map((label, idx) => (
                      <div
                        key={idx}
                        className={`${labelSize} flex items-center leading-none`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {heatmapData.weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-1">
                        {week.map((cell, dIdx) => {
                          const isInRange = cell.status === 'inRange';
                          const isFuture = cell.status === 'future';
                          const bgStyle = isFuture
                            ? { backgroundColor: '#f3f4f6' }
                            : getHeatmapStyle(cell.hours || 0, dailyHourGoal, heatmapColors);
                          const isToday = isInRange && cell.key === todayKey;
                          const dimClass = isInRange ? '' : 'opacity-40';
                          return (
                            <div
                              key={`${wIdx}-${dIdx}-${cell.key}`}
                              className={`${cellSize} rounded-sm ${dimClass} ${
                                isToday ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                              }`}
                              style={bgStyle}
                              onMouseEnter={(e) => handleCellEnter(e, cell)}
                              onMouseLeave={() => setTooltip(null)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {tooltip && (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md bg-gray-900 text-white text-[11px] shadow-lg whitespace-nowrap"
                    style={{ left: tooltip.left, top: tooltip.top - 6 }}
                  >
                    <div className="font-medium">{tooltip.hoursLabel}</div>
                    <div className="text-gray-300">{tooltip.dateLabel}</div>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-500">
                  <span>Less</span>
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatmapColors.emptyColor }} />
                  {[...heatmapColors.stops].sort((a, b) => a.upTo - b.upTo).map((stop, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: stop.color }} />
                  ))}
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatmapColors.completionColor }} />
                  <span>More</span>
                  <span className="ml-2 text-gray-400">
                    Goal: {dailyHourGoal}h/day
                  </span>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Time by task</h3>
        </div>
        {taskBreakdown.items.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 text-center">
            No tasks tracked in this range.
          </div>
        ) : (
          <div className="space-y-3">
            {taskBreakdown.items.slice(0, 10).map(item => {
              const pct = taskBreakdown.total > 0
                ? (item.seconds / taskBreakdown.total) * 100
                : 0;
              return (
                <div key={item.task} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900 truncate pr-2">
                      {item.task}
                    </span>
                    <span className="text-gray-600 whitespace-nowrap tabular-nums">
                      {item.hours.toFixed(1)}h · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {taskBreakdown.items.length > 10 && (
              <div className="text-xs text-gray-500 pt-2">
                Showing top 10 of {taskBreakdown.items.length} tasks.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
