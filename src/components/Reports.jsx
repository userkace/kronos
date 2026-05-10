import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Flame, Target, TrendingUp, BarChart3, ListChecks } from 'lucide-react';
import { loadTimesheetData } from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const RANGES = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: 'quarter', label: 'Quarter', days: 91 },
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

const Reports = () => {
  const { selectedTimezone: timezone, isInitialized: timezoneInitialized } = useTimezone();
  const { dailyHourGoal } = useUserPreferences();
  const [range, setRange] = useState('week');
  const [timesheet, setTimesheet] = useState(() => loadTimesheetData());
  const [now, setNow] = useState(() => new Date());

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

  const rangeDef = RANGES.find(r => r.id === range) || RANGES[0];
  const todayKey = useMemo(
    () => (timezoneInitialized && timezone ? dayKey(now, timezone) : null),
    [now, timezone, timezoneInitialized]
  );

  // Oldest -> newest list of {key, date, seconds, hours} for the selected range.
  const dailySeries = useMemo(() => {
    if (!todayKey) return [];
    const days = [];
    for (let i = rangeDef.days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = dayKey(d, timezone);
      const entries = timesheet[key] || [];
      const seconds = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
      days.push({ key, date: d, seconds, hours: seconds / 3600 });
    }
    return days;
  }, [timesheet, rangeDef.days, now, timezone, todayKey]);

  // Quarter view aggregates 7-day buckets so 90+ bars don't get squished.
  const chartBuckets = useMemo(() => {
    if (range !== 'quarter') return dailySeries;
    const buckets = [];
    let bucket = null;
    dailySeries.forEach((d, idx) => {
      if (idx % 7 === 0) {
        if (bucket) buckets.push(bucket);
        bucket = {
          key: d.key,
          date: d.date,
          seconds: 0,
          hours: 0,
          label: format(d.date, 'MMM d'),
        };
      }
      bucket.seconds += d.seconds;
      bucket.hours += d.hours;
    });
    if (bucket) buckets.push(bucket);
    return buckets;
  }, [dailySeries, range]);

  const maxHours = Math.max(0.5, ...chartBuckets.map(b => b.hours));
  const totalSeconds = dailySeries.reduce((s, d) => s + d.seconds, 0);
  const totalHours = totalSeconds / 3600;
  const avgPerDay = rangeDef.days > 0 ? totalHours / rangeDef.days : 0;

  // Today only — used by the goal ring card.
  const todayHours = useMemo(() => {
    if (!todayKey) return 0;
    const entries = timesheet[todayKey] || [];
    return entries.reduce((s, e) => s + entrySeconds(e, now), 0) / 3600;
  }, [timesheet, todayKey, now]);

  // Walk back from today counting consecutive days with tracked time. Today is
  // allowed to be 0 (in-progress) so a streak from yesterday isn't reset just
  // because the user hasn't started yet today.
  const streak = useMemo(() => {
    if (!todayKey) return 0;
    let count = 0;
    let cursor = now;
    let allowZeroToday = true;
    for (let i = 0; i < 366; i++) {
      const key = dayKey(cursor, timezone);
      const entries = timesheet[key] || [];
      const seconds = entries.reduce((s, e) => s + entrySeconds(e, now), 0);
      if (seconds > 0) {
        count++;
        cursor = subDays(cursor, 1);
        allowZeroToday = false;
      } else if (i === 0 && allowZeroToday) {
        cursor = subDays(cursor, 1);
        allowZeroToday = false;
      } else {
        break;
      }
    }
    return count;
  }, [timesheet, now, timezone, todayKey]);

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
            <div className="text-xs text-gray-500">Consecutive days with tracked time</div>
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

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            {range === 'quarter' ? 'Weekly hours' : 'Daily hours'}
          </h3>
        </div>

        {totalSeconds === 0 ? (
          <div className="text-sm text-gray-500 py-12 text-center">
            No tracked time in this range yet.
          </div>
        ) : (
          <div
            className="flex items-end gap-1 h-48"
            role="img"
            aria-label={`${range === 'quarter' ? 'Weekly' : 'Daily'} hours bar chart`}
          >
            {chartBuckets.map(b => {
              const heightPct = maxHours > 0 ? (b.hours / maxHours) * 100 : 0;
              const isToday = range !== 'quarter' && b.key === todayKey;
              return (
                <div
                  key={b.key}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
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
                      title={
                        range === 'quarter'
                          ? `Week of ${b.label}: ${b.hours.toFixed(2)}h`
                          : `${format(b.date, 'EEE MMM d')}: ${b.hours.toFixed(2)}h`
                      }
                    />
                  </div>
                  <div className="text-[10px] text-gray-500 truncate w-full text-center">
                    {range === 'quarter'
                      ? b.label
                      : range === 'month'
                        ? format(b.date, 'd')
                        : format(b.date, 'EEE')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
