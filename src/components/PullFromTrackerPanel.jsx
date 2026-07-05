import React, { useMemo, useState } from 'react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ArrowDownToLine, AlertTriangle } from 'lucide-react';
import { loadTimesheetData } from '../utils/storage';
import {
  writeWeeklyTimesheetForDates,
  mergeOverlappingPeriods
} from '../utils/weeklyTimesheet';
import { useToast } from '../contexts/ToastContext';

// Summarize each week day's completed tracker entries for the picker list.
const buildDaySummaries = (weekDays, timezone, weeklyData) => {
  const allData = loadTimesheetData() || {};

  return weekDays.map(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const entries = allData[dayKey] || [];
    const completedEntries = entries.filter(
      entry => !entry.isActive && entry.startTime && entry.endTime
    );
    const hasActiveEntry = entries.some(entry => entry.isActive);

    const existingRow = weeklyData?.[dayKey];
    const hasExisting = Boolean(
      existingRow &&
      (existingRow.tasks || existingRow.workDetails || existingRow.timeIn || existingRow.timeOut)
    );

    if (completedEntries.length === 0) {
      return { dayKey, day, count: 0, hasActiveEntry, hasExisting };
    }

    const startTimes = completedEntries.map(entry =>
      toZonedTime(parseISO(entry.startTime), timezone)
    );
    const endTimes = completedEntries.map(entry =>
      toZonedTime(parseISO(entry.endTime), timezone)
    );
    const earliestStart = startTimes.reduce(
      (earliest, current) => (current < earliest ? current : earliest),
      startTimes[0]
    );
    const latestEnd = endTimes.reduce(
      (latest, current) => (current > latest ? current : latest),
      endTimes[0]
    );

    const mergedPeriods = mergeOverlappingPeriods(completedEntries, timezone);
    const workedSeconds = mergedPeriods.reduce(
      (total, period) => total + differenceInSeconds(period.end, period.start),
      0
    );

    return {
      dayKey,
      day,
      count: completedEntries.length,
      hasActiveEntry,
      hasExisting,
      timeRange: `${format(earliestStart, 'h:mm a')} – ${format(latestEnd, 'h:mm a')}`,
      workedHours: workedSeconds / 3600
    };
  });
};

// Inline panel on the Weekly Timesheet page that pulls tracked days from the
// Daily Tracker into the timesheet without leaving this page. Each day of the
// viewed week is listed with a summary of its completed tracker entries;
// selected days are recomputed and written through the same
// writeWeeklyTimesheetForDates path the tracker's own "Save to Weekly
// Timesheet" button uses.
//
// The parent keys this component by the week's first day, so the initial
// selection resets on week navigation; summaries recompute whenever the
// weekly data prop refreshes (every storage write echoes back through
// App.jsx's storage-event subscription).
const PullFromTrackerPanel = ({ weekDays, timezone, weeklyData }) => {
  const daySummaries = useMemo(
    () => buildDaySummaries(weekDays, timezone, weeklyData),
    [weekDays, timezone, weeklyData]
  );
  // Preselect the "safe" days: tracker data exists and nothing in the
  // timesheet would be overwritten. Days that would overwrite start
  // unchecked so the user opts in explicitly.
  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(daySummaries.filter(s => s.count > 0 && !s.hasExisting).map(s => s.dayKey))
  );
  const { success, error } = useToast();

  const toggleDay = (dayKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  // Only days that still have tracker data count — stale selections (e.g.
  // entries deleted since selecting) are ignored rather than clearing rows.
  const selectedSummaries = daySummaries.filter(
    s => s.count > 0 && selectedKeys.has(s.dayKey)
  );
  const selectedCount = selectedSummaries.length;
  const overwriteCount = selectedSummaries.filter(s => s.hasExisting).length;

  const handlePull = () => {
    if (selectedCount === 0) return;

    const result = writeWeeklyTimesheetForDates(
      selectedSummaries.map(s => s.dayKey),
      timezone
    );

    if (result.errors.length > 0) {
      error(`Failed to pull ${result.errors.length} day(s) — see console for details`);
    }
    if (result.saved.length > 0) {
      success(
        `Pulled ${result.saved.length} day${result.saved.length === 1 ? '' : 's'} from the Daily Tracker`
      );
    }
    setSelectedKeys(new Set());
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs mt-4">
      {/* Header — standard card header: icon chip + base-size title, matching
          the section cards on the Settings/Data/Invoice tabs. */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <ArrowDownToLine className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Pull from Daily Tracker</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Fill timesheet days from your tracked entries — no need to open each day in the tracker.
          </p>
        </div>
      </div>

      {/* Day list */}
      <div className="p-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {daySummaries.map(summary => {
          const hasData = summary.count > 0;
          const isSelected = hasData && selectedKeys.has(summary.dayKey);

          return (
            <label
              key={summary.dayKey}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors duration-150 ${
                !hasData
                  ? 'border-transparent bg-gray-50/70 cursor-not-allowed'
                  : isSelected
                    ? 'border-blue-300 bg-blue-50/70 cursor-pointer'
                    : 'border-gray-200 bg-white hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!hasData}
                onChange={() => toggleDay(summary.dayKey)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30 disabled:opacity-40"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${hasData ? 'text-gray-900' : 'text-gray-400'}`}>
                    {format(summary.day, 'EEE, MMM d')}
                  </span>
                  {hasData && summary.hasExisting && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" />
                      Overwrites
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {hasData ? (
                    <>
                      {summary.count} task{summary.count === 1 ? '' : 's'} · {summary.timeRange} · {summary.workedHours.toFixed(2)} h
                    </>
                  ) : summary.hasActiveEntry ? (
                    'Timer still running — stop it to pull this day'
                  ) : (
                    'No completed entries'
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 flex-1">
          {overwriteCount > 0
            ? `${overwriteCount} selected day${overwriteCount === 1 ? '' : 's'} will replace existing timesheet values.`
            : 'Pulled days are computed from completed tracker entries.'}
        </p>
        <button
          onClick={handlePull}
          disabled={selectedCount === 0}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-150 ${
            selectedCount === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm shadow-blue-600/25'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Pull {selectedCount > 0 ? `${selectedCount} day${selectedCount === 1 ? '' : 's'}` : 'days'}
        </button>
      </div>
    </div>
  );
};

export default PullFromTrackerPanel;
