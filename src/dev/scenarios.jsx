// The Screenshot Studio's catalogue.
//
// A scenario is two halves:
//
//   seed()   — invents the world, by calling the same save functions the app
//              itself calls. It runs inside the sandbox (see sandbox.js), so
//              "saving" here writes to a throwaway copy of storage.
//   render() — mounts the REAL component against that world. Nothing in here
//              is a mock or a look-alike: if the screenshot shows a rounded
//              corner, that corner is in the shipped build.
//
// Adding one is deliberately cheap — append an entry, and it appears in the
// gallery with a card, a keyboard shortcut and a frame of its own.

import DailyTracker from '../components/DailyTracker';
import PomodoroTimer from '../components/PomodoroTimer';
import TimesheetTable from '../components/TimesheetTable';
import Reports from '../components/Reports';
import InvoicePage from '../components/InvoicePage';
import Settings from '../components/Settings';
import Onboarding from '../components/Onboarding';
import ChangelogModal from '../components/ChangelogModal';
import SyncConflictModal from '../components/SyncConflictModal';
import TimeEntryModal from '../components/TimeEntryModal';

import {
  saveTimesheetData,
  saveWeeklyTimesheet,
  loadWeeklyTimesheet,
  saveTimezone,
  saveWeekStart,
  saveWeekendDays,
  saveClockFormat,
  saveDateFormat,
  saveDailyHourGoal,
  saveShowBreaks,
  saveSortOrder,
  saveSidebarState,
  saveSelectedWeek,
  saveOnboardingCompleted,
  saveChangelogLastSeenVersion,
  saveInvoiceSettings,
  saveWorkspaces,
  getActiveWorkspaceId,
} from '../utils/storage';
import { writeWeeklyTimesheetForDates } from '../utils/weeklyTimesheet';
import { CHANGELOG, getLatestChangelogVersion } from '../data/changelog';
import {
  TASK_POOLS,
  LONG_TASK_NAMES,
  INVOICE_SETTINGS,
  buildDay,
  buildHistory,
  buildActiveEntry,
  buildSyncConflicts,
  keyOffsetFromToday,
  todayKey,
  mergeDays,
} from './fixtures';

const noop = () => {};

// ── Seeding helpers ───────────────────────────────────────────────────────

/**
 * The world every scenario starts from: onboarded, no entries, stock
 * preferences. Deliberately independent of whatever the developer running the
 * studio has configured, so the same scenario photographs identically on
 * anyone's machine.
 */
export const seedBaseline = (timezone) => {
  saveOnboardingCompleted();
  saveChangelogLastSeenVersion(getLatestChangelogVersion());
  saveTimezone(timezone);
  saveWeekStart('sunday');
  saveWeekendDays([0, 6]);
  saveClockFormat('12hour');
  saveDateFormat('weekday');
  saveDailyHourGoal(8);
  saveShowBreaks(true);
  saveSortOrder('desc');
  saveSidebarState(true);
  saveSelectedWeek(new Date());
  saveWorkspaces([{ id: getActiveWorkspaceId(), name: 'Meridian Labs' }]);
  saveTimesheetData({});
  saveWeeklyTimesheet({});
};

/**
 * Write entries and let the real aggregator derive the weekly rows from them,
 * rather than inventing a second set that could disagree with the first.
 */
const commitEntries = (data, timezone) => {
  saveTimesheetData(data);
  writeWeeklyTimesheetForDates(Object.keys(data), timezone);
};

/** Put the Pomodoro timer into a given state via the keys its provider reads. */
const seedPomodoro = ({
  phase = 'work',
  secondsLeft = 17 * 60 + 42,
  running = true,
  paused = false,
  task = '',
  tracking = false,
  currentSet = 1,
  completedSets = 0,
} = {}) => {
  const ls = {
    kronos_pomodoro_current_phase: phase,
    kronos_pomodoro_time_left: String(secondsLeft),
    kronos_pomodoro_time_left_at: String(Date.now()),
    kronos_pomodoro_is_running: JSON.stringify(running),
    kronos_pomodoro_is_paused: JSON.stringify(paused),
    kronos_pomodoro_current_set: String(currentSet),
    kronos_pomodoro_completed_sets: String(completedSets),
    kronos_pomodoro_current_task: task,
    kronos_pomodoro_is_tracking_task: JSON.stringify(tracking),
  };
  Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v));
  if (tracking) {
    localStorage.setItem(
      'kronos_pomodoro_task_start_time',
      new Date(Date.now() - 7 * 60_000).toISOString()
    );
  }
};

/** Quarantine a key the way storage.js does, to summon the recovery card. */
const seedCorruption = (key, raw) => {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  localStorage.setItem(`__kronos_corrupt_${key}_${ts}`, raw);
  localStorage.setItem('__kronos_corrupt_pending', JSON.stringify([key]));
};

// ── Scenarios ─────────────────────────────────────────────────────────────
//
// `chrome: true` wraps the view in the real sidebar + header, which is what
// you want for anything going in a README. `chrome: false` is for the pieces
// that own the whole screen anyway (onboarding) or that you want photographed
// on their own (a modal).

export const SCENARIOS = [
  // ── Tracker ─────────────────────────────────────────────────────────────
  {
    id: 'tracker-running',
    group: 'Tracker',
    label: 'Timer running',
    description:
      'Mid-afternoon: five tasks logged, a sixth still running, and the day’s ' +
      'total climbing towards the goal. The hero shot.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      const day = buildDay(key, timezone, {
        hours: 4.5,
        taskCount: 5,
        startHour: 9,
        pool: TASK_POOLS.engineering,
        seed: 21,
      });
      const data = mergeDays(
        buildHistory(timezone, {
          daysBack: 21,
          rhythm: 'steady',
          pool: TASK_POOLS.engineering,
          seed: 3,
        }),
        { [key]: day }
      );
      commitEntries(data, timezone);
      // The running entry goes on afterwards, the same way it would in life:
      // it has no end time, so it contributes nothing to the weekly rows that
      // were just derived above.
      saveTimesheetData({
        ...data,
        [key]: [...day, buildActiveEntry(key, timezone, { minutesAgo: 37 })],
      });
    },
    render: ({ timezone }) => (
      <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
    ),
  },
  {
    id: 'tracker-goal-met',
    group: 'Tracker',
    label: 'Goal reached',
    description:
      'A finished eight-hour day with breaks between blocks — the progress bar ' +
      'full and every entry closed.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries(
        mergeDays(
          buildHistory(timezone, { daysBack: 30, rhythm: 'steady', seed: 11 }),
          { [key]: buildDay(key, timezone, { hours: 8.2, taskCount: 7, startHour: 8, seed: 5 }) }
        ),
        timezone
      );
    },
    render: ({ timezone }) => (
      <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
    ),
  },
  {
    id: 'tracker-empty',
    group: 'Tracker',
    label: 'Empty day',
    description:
      'Nothing tracked yet — the first-run view, and the one that shows how the ' +
      'empty states read.',
    chrome: true,
    navView: 'tracker',
    seed: () => {},
    render: ({ timezone }) => (
      <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
    ),
  },
  {
    id: 'tracker-long-names',
    group: 'Tracker',
    label: 'Awkward task names',
    description:
      'Very long descriptions next to a one-word one. Worth a look at phone ' +
      'width before shipping any change to the entry rows.',
    chrome: true,
    navView: 'tracker',
    viewport: 'phone',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries(
        { [key]: buildDay(key, timezone, { hours: 6, taskCount: 5, pool: LONG_TASK_NAMES, seed: 42 }) },
        timezone
      );
    },
    render: ({ timezone }) => (
      <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
    ),
  },
  {
    id: 'tracker-past-day',
    group: 'Tracker',
    label: 'Looking back at a past day',
    description:
      'Opened on last week’s Tuesday, the way clicking a day in Reports gets ' +
      'you there.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      commitEntries(
        buildHistory(timezone, { daysBack: 45, endOffset: 0, rhythm: 'patchy', seed: 19 }),
        timezone
      );
    },
    render: ({ timezone }) => (
      <DailyTracker
        timezone={timezone}
        timezoneInitialized
        onTimezoneChange={noop}
        target={{ dateKey: keyOffsetFromToday(timezone, -8) }}
      />
    ),
  },

  // ── Pomodoro ────────────────────────────────────────────────────────────
  {
    id: 'pomodoro-focus',
    group: 'Pomodoro',
    label: 'Focus session running',
    description:
      'Seventeen minutes left of set two, tracking a named task — the timer ' +
      'counts down live while you shoot it.',
    chrome: true,
    navView: 'pomodoro',
    seed: ({ timezone }) => {
      commitEntries(buildHistory(timezone, { daysBack: 14, rhythm: 'steady', pool: TASK_POOLS.engineering, seed: 8 }), timezone);
      seedPomodoro({
        phase: 'work',
        secondsLeft: 17 * 60 + 42,
        running: true,
        task: 'Fix timezone drift on import',
        tracking: true,
        currentSet: 2,
        completedSets: 1,
      });
    },
    render: () => <PomodoroTimer />,
  },
  {
    id: 'pomodoro-break',
    group: 'Pomodoro',
    label: 'Long break',
    description: 'All four sets done and the long break running.',
    chrome: true,
    navView: 'pomodoro',
    seed: ({ timezone }) => {
      commitEntries(buildHistory(timezone, { daysBack: 14, rhythm: 'steady', seed: 8 }), timezone);
      seedPomodoro({
        phase: 'longBreak',
        secondsLeft: 11 * 60 + 5,
        running: true,
        currentSet: 4,
        completedSets: 4,
      });
    },
    render: () => <PomodoroTimer />,
  },
  {
    id: 'pomodoro-idle',
    group: 'Pomodoro',
    label: 'Ready to start',
    description: 'The untouched timer — full work duration, nothing running.',
    chrome: true,
    navView: 'pomodoro',
    seed: () => {},
    render: () => <PomodoroTimer />,
  },

  // ── Timesheet ───────────────────────────────────────────────────────────
  {
    id: 'timesheet-full-week',
    group: 'Timesheet',
    label: 'A full week',
    description:
      'Monday to Friday filled in, weekend blank — times in, times out, breaks ' +
      'and totals all computed by the real aggregator.',
    chrome: true,
    navView: 'timesheet',
    seed: ({ timezone }) => {
      commitEntries(
        buildHistory(timezone, { daysBack: 21, endOffset: 0, rhythm: 'steady', seed: 4 }),
        timezone
      );
    },
    render: ({ timezone, weekly }) => (
      <div className="p-6 max-w-7xl mx-auto">
        <TimesheetTable
          currentDate={new Date()}
          timesheetData={weekly}
          timezone={timezone}
          onWeekChange={noop}
        />
      </div>
    ),
  },
  {
    id: 'timesheet-partial-week',
    group: 'Timesheet',
    label: 'Half a week',
    description: 'Three days in — the rest of the week still empty rows.',
    chrome: true,
    navView: 'timesheet',
    seed: ({ timezone }) => {
      const days = {};
      for (let offset = -2; offset <= 0; offset++) {
        const key = keyOffsetFromToday(timezone, offset);
        days[key] = buildDay(key, timezone, { hours: 7.5, taskCount: 4, seed: 30 + offset });
      }
      commitEntries(days, timezone);
    },
    render: ({ timezone, weekly }) => (
      <div className="p-6 max-w-7xl mx-auto">
        <TimesheetTable
          currentDate={new Date()}
          timesheetData={weekly}
          timezone={timezone}
          onWeekChange={noop}
        />
      </div>
    ),
  },

  // ── Reports ─────────────────────────────────────────────────────────────
  {
    id: 'reports-week',
    group: 'Reports',
    label: 'Week — on a streak',
    description:
      'The week bar chart with a healthy streak behind it and the goal ring ' +
      'part-filled for today.',
    chrome: true,
    navView: 'reports',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries(
        mergeDays(
          buildHistory(timezone, { daysBack: 60, rhythm: 'steady', seed: 6 }),
          { [key]: buildDay(key, timezone, { hours: 5.25, taskCount: 4, seed: 13 }) }
        ),
        timezone
      );
    },
    render: () => <Reports onOpenDay={noop} initialRange="week" />,
  },
  {
    id: 'reports-month',
    group: 'Reports',
    label: 'Month heatmap',
    description: 'A month of uneven days — the case the heatmap colours exist for.',
    chrome: true,
    navView: 'reports',
    seed: ({ timezone }) => {
      commitEntries(
        buildHistory(timezone, { daysBack: 70, endOffset: 0, rhythm: 'patchy', seed: 23 }),
        timezone
      );
    },
    render: () => <Reports onOpenDay={noop} initialRange="month" />,
  },
  {
    id: 'reports-quarter',
    group: 'Reports',
    label: 'Quarter — building up',
    description:
      'Three months that start light and get heavier, so the heatmap has a ' +
      'visible gradient across it.',
    chrome: true,
    navView: 'reports',
    seed: ({ timezone }) => {
      commitEntries(
        buildHistory(timezone, { daysBack: 120, endOffset: 0, rhythm: 'ramping', seed: 31 }),
        timezone
      );
    },
    render: () => <Reports onOpenDay={noop} initialRange="quarter" />,
  },

  // ── Invoice ─────────────────────────────────────────────────────────────
  {
    id: 'invoice-ready',
    group: 'Invoice',
    label: 'Invoice, ready to export',
    description:
      'A month of billable days against a client, an hourly rate and a ' +
      'currency — the state just before Download PDF.',
    chrome: true,
    navView: 'invoice',
    seed: ({ timezone }) => {
      saveInvoiceSettings(INVOICE_SETTINGS);
      commitEntries(
        buildHistory(timezone, { daysBack: 38, endOffset: 0, rhythm: 'steady', seed: 17 }),
        timezone
      );
    },
    render: () => <InvoicePage />,
  },

  // ── Settings ────────────────────────────────────────────────────────────
  {
    id: 'settings-general',
    group: 'Settings',
    label: 'Settings — General',
    description: 'The settings page as it opens: search, category rail, General group.',
    chrome: true,
    navView: 'settings',
    seed: () => {},
    render: () => <Settings target={{ category: 'general' }} onImportSuccess={noop} />,
  },
  {
    id: 'settings-appearance',
    group: 'Settings',
    label: 'Settings — Appearance',
    description: 'Theme, dark tone, sidebar items and the chart colour pickers.',
    chrome: true,
    navView: 'settings',
    seed: () => {},
    render: () => <Settings target={{ category: 'appearance' }} onImportSuccess={noop} />,
  },
  {
    id: 'settings-recovery',
    group: 'Settings',
    label: 'Settings — Data Recovery',
    description:
      'The amber card that only appears when something failed to parse on ' +
      'load. Hard to photograph any other way.',
    chrome: true,
    navView: 'settings',
    seed: () => {
      seedCorruption('kronos_invoice_settings', '{"userName":"Robin",,,}');
    },
    render: () => <Settings target={{ category: 'data' }} onImportSuccess={noop} />,
  },

  // ── Flows & overlays ────────────────────────────────────────────────────
  {
    id: 'onboarding',
    group: 'Flows & overlays',
    label: 'Onboarding',
    description:
      'The first-run flow, live — step through it in the frame; nothing it ' +
      'saves survives the scenario.',
    chrome: false,
    seed: () => {},
    render: ({ timezone }) => <Onboarding onComplete={noop} initialTimezone={timezone} />,
  },
  {
    id: 'changelog-modal',
    group: 'Flows & overlays',
    label: 'What’s new',
    description: 'The release-notes modal over a populated tracker.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries({ [key]: buildDay(key, timezone, { hours: 6, taskCount: 5, seed: 9 }) }, timezone);
    },
    render: ({ timezone }) => (
      <>
        <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
        <ChangelogModal entries={CHANGELOG.slice(0, 2)} onDismiss={noop} />
      </>
    ),
  },
  {
    id: 'entry-modal',
    group: 'Flows & overlays',
    label: 'Editing an entry',
    description: 'The time-entry modal in edit mode, over the day it belongs to.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries({ [key]: buildDay(key, timezone, { hours: 6, taskCount: 5, seed: 27 }) }, timezone);
    },
    render: ({ timezone, entries }) => (
      <>
        <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
        <TimeEntryModal
          isOpen
          mode="edit"
          initialData={entries[0]}
          timezone={timezone}
          selectedDate={new Date()}
          onSave={noop}
          onDelete={noop}
          onClose={noop}
        />
      </>
    ),
  },
  {
    id: 'sync-conflict',
    group: 'Flows & overlays',
    label: 'Sync conflict',
    description:
      'The resolver shown when signing in finds the same day edited on two ' +
      'devices — field-level and whole-value choices side by side.',
    chrome: true,
    navView: 'tracker',
    seed: ({ timezone }) => {
      const key = todayKey(timezone);
      commitEntries({ [key]: buildDay(key, timezone, { hours: 5, taskCount: 4, seed: 55 }) }, timezone);
    },
    render: ({ timezone }) => (
      <>
        <DailyTracker timezone={timezone} timezoneInitialized onTimezoneChange={noop} />
        <SyncConflictModal conflicts={buildSyncConflicts(timezone)} onResolve={noop} />
      </>
    ),
  },
];

export const SCENARIO_GROUPS = [...new Set(SCENARIOS.map(s => s.group))];

export const findScenario = (id) =>
  SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];

/** Weekly rows as the scenario left them — handed to render() for TimesheetTable. */
export const currentWeekly = () => loadWeeklyTimesheet();
