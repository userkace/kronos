// Single source of truth for the "What's new" modal.
//
// HOW TO ADD A RELEASE:
//   1. Insert a NEW entry at the TOP of CHANGELOG (newest first — the array
//      order is what determines "newer than lastSeen").
//   2. Set `version` to a unique STRING. Format is up to you (semver, dates,
//      whatever); the modal logic only checks string equality with the
//      user's stored last-seen value.
//   3. Set `date` (yyyy-MM-dd) and a short `title`.
//   4. List `changes` with one of: 'added' | 'fixed' | 'changed' | 'removed'.
//
// The modal pops when localStorage's lastSeenVersion !== the latest version
// here (string equality). Brand-new installs are seeded at the latest version
// so the first user experience is the onboarding flow, not a wall of changelog.

export const CHANGE_TYPES = {
  added: { label: 'New', tone: 'green' },
  fixed: { label: 'Fixed', tone: 'blue' },
  changed: { label: 'Changed', tone: 'amber' },
  removed: { label: 'Removed', tone: 'red' },
};

// Newest first.
export const CHANGELOG = [
  {
    version: '0.3.3',
    date: '2026-05-15',
    title: 'Reports average excludes non-work days',
    changes: [
      { type: 'fixed', description: 'Average per day in the Range Total card now divides by work days only, matching your Non-Work Days setting — weekends no longer drag the average down.' },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-05-13',
    title: 'Brand refresh & settings improvements',
    changes: [
      { type: 'added', description: 'Goal ring colors: customize the in-progress and completion colors for the daily goal ring in Reports, with a "Copy from heatmap" shortcut.' },
      { type: 'added', description: 'Settings now shows a persistent toast when you have unsaved changes, with Save and Revert buttons directly in the notification.' },
      { type: 'added', description: 'Date format setting in Settings → Clock Format: choose from 8 formats for the date shown alongside the clock in the navigation bar — including full weekday, no-year, DMY, ISO, and time-only.' },
      { type: 'changed', description: 'Clock Format setting moved above Work Schedule in Settings.' },
      { type: 'changed', description: 'Replaced clock icon with Kronos logo in sidebar header for better brand identity.' },
      { type: 'changed', description: 'Updated sidebar tagline to "Own your time." for a more empowering message.' },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-05-12',
    title: 'Customizable heatmap colors',
    changes: [
      { type: 'added', description: 'Heatmap colors are now fully customizable in Settings. Set the color for each progress stop, define the percentage thresholds where colors change, and pick separate colors for "goal met" and "no time tracked" days.' },
      { type: 'added', description: 'Add or remove color stops to create as many or as few color bands as you like. A Reset to Default button restores the original blue scheme at any time.' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-05-12',
    title: 'PWA support — install Kronos as a standalone app',
    changes: [
      { type: 'added', description: 'Kronos is now a Progressive Web App. You can install it from your browser\'s address bar (desktop) or "Add to Home Screen" (mobile) and run it as a standalone app with no browser chrome.' },
      { type: 'added', description: 'A service worker caches all app assets on first load, so Kronos loads instantly on repeat visits and continues to work offline — your localStorage data is always available.' },
      { type: 'added', description: 'App updates are downloaded silently in the background and applied the next time you open Kronos, so you always get the latest version without any manual action.' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-05-11',
    title: 'Reports heatmap redesign: calendar periods, floating tooltips & full context',
    changes: [
      { type: 'added', description: 'Hovering a day cell on the month/quarter heatmap shows a GitHub-style floating tooltip with the date and hours tracked, replacing the slow native browser tooltip.' },
      { type: 'added', description: 'Future days of the current period now render as dimmed empty slots instead of being hidden, so the heatmap reads as a complete calendar block rather than something that ends abruptly on today.' },
      { type: 'changed', description: 'Month and quarter views are now calendar-based rather than rolling 30/91-day windows. "Month" snaps to the calendar month containing today; "Quarter" snaps to the calendar quarter.' },
      { type: 'changed', description: 'The heatmap is right-anchored on the current period and extends backward by full weeks to fill the card\'s available width — so wider screens show many months of past history at lower opacity. The minimum is always the previous full month/quarter plus the current one.' },
      { type: 'changed', description: 'Range Total and Average per day now reflect "this period so far" (period start through today) rather than a rolling N-day total.' },
      { type: 'changed', description: 'Heatmap weekday labels are consistent regardless of week-start setting: Sunday-first weeks show M / W / F, and Monday-first weeks show M / W / F / S. Previously Monday-first weeks showed the off-letters T / T / S.' },
      { type: 'fixed', description: 'Month and quarter heatmaps no longer disappear entirely when the current period has no tracked time yet — the empty grid and any prior-period history still render so you can see where you are in the calendar.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-05-11',
    title: 'Inline editing, Undo system, Reports view, Goals & Mobile redesign',
    changes: [
      { type: 'added', description: 'Click an entry\'s name or start/end time to edit it inline — no modal trip. Name opens as a multi-line textarea sized to match the rendered task (Enter saves, Shift+Enter inserts a newline, Esc cancels).' },
      { type: 'added', description: 'Deleting an entry or merging duplicates now shows an Undo toast for ~5s, restoring the day\'s entries verbatim if clicked.' },
      { type: 'added', description: 'Reports view: weekly/monthly/quarterly bars of tracked hours, time-by-task breakdown, current streak, and a daily-goal progress ring.' },
      { type: 'added', description: 'Daily hour goal setting (Settings → Daily Hour Goal) drives the goal ring on the Reports view.' },
      { type: 'added', description: 'Daily Tracker total shines gold (with a soft glow) once the day\'s tracked time meets your daily hour goal — same idea as the green pulse for an active timer.' },
      { type: 'added', description: 'Non-work days setting (defaults to Sat + Sun, multi-select any subset). Days marked as non-work no longer break your Reports streak when you don\'t track time on them. Configurable in onboarding and Settings → Non-Work Days.' },
      { type: 'added', description: 'Header bell icon opens the "What\'s new" changelog at any time, with a red dot when there are unread updates.' },
      { type: 'fixed', description: 'Edit modal time validation now compares seconds, not minutes — sub-minute differences (e.g. 09:00:30 → 09:00:45) no longer falsely trigger the "end equals start" toast.' },
      { type: 'changed', description: 'Weekly Timesheet now uses a stacked card-per-day layout on phone-sized screens. The wide table still appears on tablet and up.' },
      { type: 'changed', description: 'Merging duplicates no longer requires a confirm prompt — Undo replaces it.' },
      { type: 'changed', description: 'Release dates in the "What\'s new" modal now render as "Month Day, Year" (e.g. "May 11, 2026") instead of the raw yyyy-MM-dd source string.' },
    ],
  },
  {
    version: '0.1.0',
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

// Latest version string. By convention the first entry in CHANGELOG, since
// the file is newest-first. Returns null when the changelog is empty.
export const getLatestChangelogVersion = () =>
  CHANGELOG.length > 0 ? CHANGELOG[0].version : null;

// All entries newer than `lastSeen`. We walk CHANGELOG (newest-first) and
// stop the first time we hit an entry whose version equals `lastSeen` —
// every entry before that point is "new". When `lastSeen` is null/missing
// or doesn't match any entry (e.g. legacy numeric values), we return the
// full log so the user catches up.
export const getChangesSince = (lastSeen) => {
  if (lastSeen == null) return [...CHANGELOG];
  const entries = [];
  for (const entry of CHANGELOG) {
    if (entry.version === lastSeen) break;
    entries.push(entry);
  }
  return entries;
};
