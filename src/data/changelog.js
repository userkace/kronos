// Single source of truth for the "What's new" modal.
//
// HOW TO ADD A RELEASE:
//   1. Insert a NEW entry at the TOP of CHANGELOG.
//   2. Set `version` to the previous max + 1 (monotonic — never reuse).
//   3. Set `date` (yyyy-MM-dd) and a short `title`.
//   4. List `changes` with one of: 'added' | 'fixed' | 'changed' | 'removed'.
//
// The modal pops when localStorage's lastSeenVersion < the highest version here.
// Brand-new installs are seeded at the highest version so the first user
// experience is the onboarding flow, not a wall of changelog.

export const CHANGE_TYPES = {
  added: { label: 'New', tone: 'green' },
  fixed: { label: 'Fixed', tone: 'blue' },
  changed: { label: 'Changed', tone: 'amber' },
  removed: { label: 'Removed', tone: 'red' },
};

// Newest first.
export const CHANGELOG = [
  {
    version: 2,
    date: '2026-05-11',
    title: 'Inline editing, Undo system, Reports view & Mobile timesheet redesign',
    changes: [
      { type: 'added', description: 'Click an entry\'s name or start/end time to edit it inline — no modal trip. Name opens as a multi-line textarea sized to match the rendered task (Enter saves, Shift+Enter inserts a newline, Esc cancels).' },
      { type: 'added', description: 'Deleting an entry or merging duplicates now shows an Undo toast for ~5s, restoring the day\'s entries verbatim if clicked.' },
      { type: 'added', description: 'Reports view: weekly/monthly/quarterly bars of tracked hours, time-by-task breakdown, current streak, and a daily-goal progress ring.' },
      { type: 'added', description: 'Daily hour goal setting (Settings → Daily Hour Goal) drives the goal ring on the Reports view.' },
      { type: 'added', description: 'Header bell icon opens the "What\'s new" changelog at any time, with a red dot when there are unread updates.' },
      { type: 'fixed', description: 'Edit modal time validation now compares seconds, not minutes — sub-minute differences (e.g. 09:00:30 → 09:00:45) no longer falsely trigger the "end equals start" toast.' },
      { type: 'changed', description: 'Weekly Timesheet now uses a stacked card-per-day layout on phone-sized screens. The wide table still appears on tablet and up.' },
      { type: 'added', description: 'Non-work days setting (defaults to Sat + Sun, multi-select any subset). Days marked as non-work no longer break your Reports streak when you don\'t track time on them. Configurable in onboarding and Settings → Non-Work Days.' },
      { type: 'changed', description: 'Merging duplicates no longer requires a confirm prompt — Undo replaces it.' },
    ],
  },
  {
    version: 1,
    date: '2026-05-11',
    title: 'Data integrity, accuracy & stability foundation',
    changes: [
      // Recovery & validation
      { type: 'added', description: 'Data Recovery section in Settings: restore, download, or discard quarantined backups when corruption is detected.' },
      { type: 'added', description: 'Persistent banner when corrupt storage is detected; saves are paused until you resolve.' },
      { type: 'fixed', description: 'Backup imports validate every entry, rejecting malformed data with a specific error instead of silently corrupting storage.' },
      { type: 'fixed', description: 'Corrupt persisted Pomodoro state no longer crashes the app on the next phase completion.' },

      // Data-loss prevention
      { type: 'fixed', description: 'Multi-day timer rollovers now record every intermediate day instead of losing them.' },
      { type: 'fixed', description: 'Stopping a timer deleted in another tab now restores the tracked time instead of silently dropping it.' },
      { type: 'fixed', description: 'Multiple simultaneous active timers across days are detected on load and the older ones auto-closed (capped at 8h) so totals stop double-counting.' },
      { type: 'fixed', description: 'Pomodoro state from a long-closed tab no longer invents hours of work — sessions stale beyond 5 minutes are reset on reopen.' },
      { type: 'fixed', description: "Deleting the last weekly row now persists correctly instead of being skipped." },
      { type: 'fixed', description: 'Entry IDs use UUIDs, eliminating same-millisecond collisions and mixed-type equality bugs.' },

      // Accuracy
      { type: 'fixed', description: 'Pomodoro pauses no longer count as work in daily totals.' },
      { type: 'fixed', description: 'Weekly timesheet preserves second-level precision in display, calculation, and copy-to-clipboard.' },
      { type: 'fixed', description: 'Midnight rollovers no longer drop a second per crossing.' },
      { type: 'fixed', description: 'Entries near midnight after a same-tab timezone change now land on the correct day.' },

      // UX
      { type: 'fixed', description: 'Time entry modal requires an explicit "Overnight shift" toggle for end-before-start times — typos no longer silently produce 23-hour entries.' },
      { type: 'fixed', description: 'Invoice date pickers no longer shift the field you didn\'t edit when ranges go out of order.' },
      { type: 'fixed', description: 'Invoice PDF totals and row amounts now derive from the same settings snapshot while typing.' },
      { type: 'fixed', description: 'Edit-modal "unsaved changes" prompt only fires for actual changes now.' },
      { type: 'fixed', description: 'UTC timezone users get document title updates and other timezone-gated features.' },

      // Stability & internals
      { type: 'fixed', description: 'Pomodoro phase completion is single-fire — duplicates from React StrictMode or rapid state changes are prevented.' },
      { type: 'fixed', description: 'Pomodoro timer ticks correctly across throttled background tabs and catches up immediately on tab focus.' },
      { type: 'changed', description: 'Storage event listeners are microtask-deferred to prevent listener-triggered recursion.' },
      { type: 'changed', description: 'Pomodoro reads timezone from a single source instead of polling localStorage every second.' },
      { type: 'changed', description: 'Internal cleanups: dedup runs on imports, debug logs removed, constants hoisted out of render paths.' },
    ],
  },
];

// Highest version present. Returns 0 when the changelog is empty.
export const getLatestChangelogVersion = () =>
  CHANGELOG.reduce((max, entry) => Math.max(max, entry.version), 0);

// All entries with a version strictly greater than the given one, newest first.
export const getChangesSince = (lastSeenVersion) =>
  CHANGELOG
    .filter(entry => entry.version > (lastSeenVersion ?? 0))
    .sort((a, b) => b.version - a.version);
