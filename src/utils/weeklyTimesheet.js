// Shared logic for recomputing and writing weekly timesheet rows.
// Used by every code path that mutates timesheet entries (timer stop,
// manual add/edit, delete, merge, pomodoro completion) so all of them
// keep the weekly view in sync.

import { format, parseISO, parse, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  loadTimesheetData,
  loadWeeklyTimesheet,
  saveWeeklyTimesheet
} from './storage';

const mergeOverlappingPeriods = (entries, timezone) => {
  if (entries.length === 0) return [];

  const periods = entries.map(entry => {
    const start = toZonedTime(parseISO(entry.startTime), timezone);
    const end = toZonedTime(parseISO(entry.endTime), timezone);

    const normalizedStart = new Date(start);
    normalizedStart.setSeconds(0, 0);

    const normalizedEnd = new Date(end);
    normalizedEnd.setSeconds(0, 0);

    return { start: normalizedStart, end: normalizedEnd };
  });

  periods.sort((a, b) => a.start - b.start);

  const merged = [];
  let current = periods[0];

  for (let i = 1; i < periods.length; i++) {
    const next = periods[i];
    if (next.start <= current.end) {
      current.end = new Date(Math.max(current.end, next.end));
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
};

/**
 * Recompute and persist weekly timesheet rows for the given dates by reading
 * the current entries from timesheet storage. Days that no longer have any
 * completed entries get their weekly row cleared. Returns the saved/cleared
 * dates so callers can render UI feedback.
 *
 * @param {string[]} targetDates - 'yyyy-MM-dd' date strings to recompute.
 * @param {string} timezone - IANA timezone used to project entry times.
 * @returns {{ saved: Array, cleared: Array, errors: Array }}
 */
export const writeWeeklyTimesheetForDates = (targetDates, timezone) => {
  const result = { saved: [], cleared: [], errors: [] };
  if (!Array.isArray(targetDates) || targetDates.length === 0) return result;

  const allData = loadTimesheetData() || {};
  const weeklyData = loadWeeklyTimesheet() || {};
  let weeklyDirty = false;

  const uniqueDates = [...new Set(targetDates.filter(Boolean))];

  uniqueDates.forEach(dateString => {
    try {
      const entriesForDate = allData[dateString] || [];
      const completedEntries = entriesForDate.filter(
        entry => !entry.isActive && entry.endTime
      );
      const dateObj = parse(dateString, 'yyyy-MM-dd', new Date());

      if (completedEntries.length === 0) {
        if (weeklyData[dateString]) {
          delete weeklyData[dateString];
          weeklyDirty = true;
          result.cleared.push({ dateString, dateObj });
        }
        return;
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

      earliestStart.setSeconds(0, 0);
      latestEnd.setSeconds(0, 0);

      const mergedPeriods = mergeOverlappingPeriods(completedEntries, timezone);
      const totalWorkMinutes = mergedPeriods.reduce(
        (total, period) => total + differenceInMinutes(period.end, period.start),
        0
      );
      const timeSpanMinutes = differenceInMinutes(latestEnd, earliestStart);
      const breakHoursDecimal = Math.max(
        0,
        (timeSpanMinutes - totalWorkMinutes) / 60
      );

      const uniqueDescriptions = [
        ...new Set(
          completedEntries
            .map(entry => entry.description)
            .filter(desc => desc && desc.trim())
        )
      ];
      const workDetails = uniqueDescriptions.join('; ');

      const existing = weeklyData[dateString] || {
        tasks: '',
        workDetails: '',
        timeIn: '',
        timeOut: '',
        breakHours: '0'
      };

      weeklyData[dateString] = {
        ...existing,
        tasks: `${completedEntries.length} task(s)`,
        workDetails,
        timeIn: format(earliestStart, 'HH:mm'),
        timeOut: format(latestEnd, 'HH:mm'),
        breakHours: breakHoursDecimal.toFixed(2)
      };
      weeklyDirty = true;

      result.saved.push({
        dateString,
        dateObj,
        completedCount: completedEntries.length
      });
    } catch (err) {
      console.error('Error writing weekly timesheet for date:', dateString, err);
      result.errors.push({ dateString, error: err });
    }
  });

  if (weeklyDirty) {
    saveWeeklyTimesheet(weeklyData);
  }

  return result;
};
