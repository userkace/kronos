// Invented-but-plausible data for the Screenshot Studio.
//
// Two rules hold this file together:
//
//   1. Deterministic. Every choice comes from a seeded generator, so the same
//      scenario produces the same day, the same tasks and the same totals
//      every time — otherwise a screenshot could never be retaken.
//   2. Anchored to today. Dates are built relative to the current date in the
//      viewer's timezone, so heatmaps, streaks and "today" headings always
//      look current instead of pointing at whenever the fixture was written.
//
// Entries are shaped exactly like the ones DailyTracker writes — same fields,
// same ISO timestamps — so everything downstream (weekly rows, reports,
// invoices) is computed by the real code from these rather than faked twice.

import { format, addDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

// ── Deterministic randomness ──────────────────────────────────────────────
// mulberry32: small, fast, and stable across runs — all we need for "pick a
// task name" and "make this day a bit longer than that one".
const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// ── Task vocabularies ─────────────────────────────────────────────────────
// One per persona, so a scenario reads like somebody's actual week rather
// than "Task 1, Task 2". Keep them short — long names are their own scenario.
export const TASK_POOLS = {
  freelance: [
    'Client kickoff call',
    'Homepage wireframes',
    'Design review — Meridian',
    'Invoice + expenses',
    'Brand guidelines draft',
    'Email backlog',
    'Logo revisions, round 2',
    'Proposal for Northwind',
    'Asset handoff',
    'Weekly client update',
  ],
  engineering: [
    'Sync engine conflict handling',
    'Code review — PR #412',
    'Standup',
    'Fix timezone drift on import',
    'Pair on the settings rewrite',
    'Write migration notes',
    'Debug flaky heatmap test',
    'Sprint planning',
    'Refactor storage layer',
    'Release checklist',
  ],
  study: [
    'Lecture — distributed systems',
    'Problem set 4',
    'Reading: chapter 9',
    'Lab write-up',
    'Study group',
    'Revision — past papers',
    'Office hours',
    'Essay draft',
  ],
};

// A deliberately awkward day: the names that break layouts, kept as their own
// pool so there's always a scenario that tests wrapping and truncation.
export const LONG_TASK_NAMES = [
  'Quarterly stakeholder alignment workshop — discovery phase, part two',
  'Migrate the legacy timesheet importer onto the new storage layer (spike)',
  'Call',
  'Rewrite the onboarding copy so it stops saying "synchronisation"',
  'Accessibility pass: focus order, contrast, and keyboard traps in Settings',
];

// ── Date helpers ──────────────────────────────────────────────────────────

/** yyyy-MM-dd for `date` as it reads in `timezone`. */
export const dayKey = (date, timezone) =>
  format(toZonedTime(date, timezone), 'yyyy-MM-dd');

export const todayKey = (timezone) => dayKey(new Date(), timezone);

/** The key `offset` calendar days from today (negative = in the past). */
export const keyOffsetFromToday = (timezone, offset) =>
  format(addDays(toZonedTime(new Date(), timezone), offset), 'yyyy-MM-dd');

/** The instant of a wall-clock minute-of-day on `key`, read in `timezone`. */
const atMinute = (key, timezone, minuteOfDay) => {
  const h = String(Math.floor(minuteOfDay / 60) % 24).padStart(2, '0');
  const m = String(Math.floor(minuteOfDay % 60)).padStart(2, '0');
  return fromZonedTime(`${key}T${h}:${m}:00`, timezone);
};

// Not entryUtils.generateEntryId(): that one mixes in the clock and a random
// number, and a fixture whose ids change between renders remounts every row.
let idCounter = 0;
const fixtureId = (key, index) => `fixture_${key}_${index}_${idCounter++}`;

// ── Builders ──────────────────────────────────────────────────────────────

/**
 * A day's entries: `taskCount` blocks laid end to end from `startHour`,
 * separated by short gaps (which the app reads as breaks) and adding up to
 * roughly `hours` of tracked time.
 */
export const buildDay = (key, timezone, {
  hours = 8,
  taskCount = 5,
  startHour = 9,
  pool = TASK_POOLS.freelance,
  seed = 1,
  lunchAfter = 2,      // a longer gap after this many blocks
  lunchMinutes = 45,
} = {}) => {
  const rng = makeRng(seed);
  const entries = [];
  const blockMinutes = Math.max(15, Math.round((hours * 60) / taskCount));
  let cursor = startHour * 60 + Math.round(rng() * 20); // a ragged start time

  const used = new Set();
  for (let i = 0; i < taskCount; i++) {
    // Vary each block by ±20% so the day doesn't look machine-generated, then
    // round to 5 minutes the way a human's timer roughly would.
    const jitter = 0.8 + rng() * 0.4;
    const minutes = Math.max(10, Math.round((blockMinutes * jitter) / 5) * 5);

    let description = pick(rng, pool);
    let guard = 0;
    while (used.has(description) && guard++ < pool.length) {
      description = pick(rng, pool);
    }
    used.add(description);

    entries.push({
      id: fixtureId(key, i),
      description,
      startTime: atMinute(key, timezone, cursor).toISOString(),
      endTime: atMinute(key, timezone, cursor + minutes).toISOString(),
      duration: minutes * 60,
      isActive: false,
      timezone,
    });

    cursor += minutes;
    cursor += i === lunchAfter - 1 ? lunchMinutes : 5 + Math.round(rng() * 15);
  }

  return entries;
};

/**
 * An entry that is still running: no endTime, `isActive`, started
 * `minutesAgo` ago. This is what makes the tracker's big timer tick in a
 * screenshot instead of sitting at zero.
 */
export const buildActiveEntry = (key, timezone, {
  description = 'Sync engine conflict handling',
  minutesAgo = 37,
} = {}) => ({
  id: fixtureId(key, 999),
  description,
  startTime: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  endTime: null,
  duration: 0,
  isActive: true,
  timezone,
});

/**
 * A run of past days, from `daysBack` ago up to `endOffset` (-1 = yesterday).
 *
 * `rhythm` decides how much lands on any given day, which is really what the
 * Reports view is a picture of:
 *   - 'steady'  — close to the goal on weekdays, nothing at weekends
 *   - 'ramping' — light early in the range, heavier by the end
 *   - 'patchy'  — real life: short days, the odd weekend, a few gaps
 */
export const buildHistory = (timezone, {
  daysBack = 90,
  endOffset = -1,
  goalHours = 8,
  rhythm = 'steady',
  pool = TASK_POOLS.freelance,
  seed = 7,
} = {}) => {
  const rng = makeRng(seed);
  const data = {};
  const span = Math.max(1, daysBack + endOffset);

  for (let offset = -daysBack; offset <= endOffset; offset++) {
    const key = keyOffsetFromToday(timezone, offset);
    const [y, m, d] = key.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const progress = (offset + daysBack) / span;

    let hours;
    if (rhythm === 'ramping') {
      if (isWeekend) {
        if (rng() > 0.15) continue;
        hours = 1.5 + rng() * 2;
      } else {
        hours = goalHours * (0.45 + progress * 0.7) * (0.85 + rng() * 0.3);
      }
    } else if (rhythm === 'patchy') {
      if (isWeekend) {
        if (rng() > 0.25) continue;
        hours = 1 + rng() * 3;
      } else if (rng() < 0.12) {
        continue;                                         // a day off
      } else if (rng() < 0.25) {
        hours = goalHours * (0.3 + rng() * 0.3);          // a short one
      } else {
        hours = goalHours * (0.8 + rng() * 0.45);
      }
    } else {
      if (isWeekend) continue;
      hours = goalHours * (0.85 + rng() * 0.3);
    }

    hours = Math.min(11, Math.max(0.5, hours));
    data[key] = buildDay(key, timezone, {
      hours,
      taskCount: Math.max(2, Math.round(hours / 1.6)),
      startHour: 8 + Math.round(rng() * 2),
      pool,
      seed: Math.floor(rng() * 1e9),
    });
  }

  return data;
};

/** Merge day-keyed maps, later arguments winning on a clash. */
export const mergeDays = (...maps) => Object.assign({}, ...maps);

/** Invoice details with a real-looking client, for the invoice scenarios. */
export const INVOICE_SETTINGS = {
  userName: 'Robin Alvarez',
  userAddress: '14 Windmill Lane\nBrighton BN1 4JP\nUnited Kingdom',
  userEmail: 'robin@alvarez.studio',
  clientName: 'Meridian Labs Ltd.',
  clientAddress: '2nd Floor, 88 Hoxton Street\nLondon N1 6LP',
  hourlyRate: 75,
  currency: 'GBP',
};

/** Cloud-sync clashes, shaped the way SyncConflictModal expects them. */
export const buildSyncConflicts = (timezone) => {
  const key = keyOffsetFromToday(timezone, -1);
  const entry = (description, startMin, endMin) => ({
    id: fixtureId(key, 500),
    description,
    startTime: atMinute(key, timezone, startMin).toISOString(),
    endTime: atMinute(key, timezone, endMin).toISOString(),
    timezone,
  });

  return [
    {
      id: 'default::kronos_timesheet_data',
      wsId: 'default',
      workspaceName: 'Meridian Labs',
      label: 'Time entries',
      fields: [
        {
          key: `${key}#a1`,
          label: `${key} · afternoon block`,
          localValue: entry('Design review — Meridian', 13 * 60 + 30, 16 * 60 + 45),
          cloudValue: entry('Design review — Meridian (round 2)', 13 * 60 + 30, 17 * 60 + 30),
        },
        {
          key: `${key}#a2`,
          label: `${key} · first thing`,
          localValue: entry('Email backlog', 9 * 60, 9 * 60 + 40),
          cloudValue: undefined,
        },
      ],
    },
    {
      id: 'default::kronos_invoice_settings',
      wsId: 'default',
      workspaceName: 'Meridian Labs',
      label: 'Invoice settings',
      fields: [
        { key: 'hourlyRate', label: 'Hourly rate', localValue: 75, cloudValue: 82 },
        { key: 'currency', label: 'Currency', localValue: 'GBP', cloudValue: 'EUR' },
      ],
    },
    {
      id: 'global::kronos_daily_hour_goal',
      wsId: 'default',
      label: 'Daily hours goal',
      localValue: '8',
      cloudValue: '6.5',
      kind: 'ls',
    },
  ];
};
