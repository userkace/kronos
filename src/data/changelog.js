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
  changed: { label: 'Changed', tone: 'amber' },
  fixed: { label: 'Fixed', tone: 'blue' },
  removed: { label: 'Removed', tone: 'red' },
};

// Newest first.
export const CHANGELOG = [
  {
    version: '0.6.0',
    date: '2026-06-24',
    title: 'Workspaces',
    changes: [
      { type: 'added', description: 'Workspaces let freelancers keep multiple clients separate — each workspace has its own time logs, weekly timesheet, invoice settings, timezone, and display preferences.' },
      { type: 'added', description: 'A workspace switcher now sits at the top of the sidebar. Switch between workspaces, create new ones inline, or open "Manage workspaces" to rename and delete.' },
      { type: 'added', description: 'Deleting a workspace asks for confirmation and permanently removes all of that workspace\'s data; at least one workspace is always kept.' },
      { type: 'changed', description: 'Your existing data is automatically kept in a "Default workspace" (which you can rename) — nothing to migrate.' },
      { type: 'changed', description: 'Import and export now operate on the active workspace, so you can back up and restore each client\'s data independently.' },
      { type: 'changed', description: 'The active task card in the sidebar is refined to match the Pomodoro widget: a filled play badge, a green "Tracking" label, and a live animated progress bar.' },
      { type: 'changed', description: 'Delete and merge toasts now shorten long task names so the notification no longer stretches across the screen.' },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-06-11',
    title: 'Onboarding redesign',
    changes: [
      { type: 'added', description: 'New Unbounded display font for brand moments — the Kronos wordmark and onboarding headings — paired with Inter for body text.' },
      { type: 'added', description: 'A branded splash screen now welcomes you when the app opens, and right after you finish onboarding.' },
      { type: 'added', description: 'Pressing Enter during onboarding now advances to the next step instead of doing nothing.' },
      { type: 'changed', description: 'Onboarding rebuilt from the ground up: a single focused card with an animated progress bar, step counter, and smooth slide transitions between steps.' },
      { type: 'changed', description: 'Week start is now a sliding segmented control and non-work days are pill toggles, replacing the old dropdown and square buttons.' },
      { type: 'changed', description: 'Welcome step refreshed with a feature list and a calmer ambient backdrop (soft color washes over a faint dot grid).' },
      { type: 'changed', description: 'Data, Settings, Reports, Invoice, Timesheet, and Pomodoro pages restyled to match the new look: display-font page headings, sections as standalone cards with color-tinted icon tiles, pill-style day toggles, and refined buttons.' },
      { type: 'changed', description: '"What\'s new" modal restyled: sheet-style on mobile, tinted icon tile header, version numbers alongside entry titles, softer badge rings, and a refined footer button.' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-06-10',
    title: 'Modern design refresh',
    changes: [
      { type: 'changed', description: 'New typography: the app now uses the Inter variable font with refined sizes, weights, and tighter heading spacing for a crisper, more modern look.' },
      { type: 'changed', description: 'Cards, modals, and panels redesigned with softer rounded corners, subtle layered shadows, and lighter borders across every view.' },
      { type: 'changed', description: 'Buttons, inputs, and dropdowns restyled with consistent sizing, gentler focus rings, and smoother hover transitions.' },
      { type: 'changed', description: 'Sidebar navigation and header refreshed with cleaner spacing, a rounded time pill, and better visual hierarchy.' },
      { type: 'changed', description: 'Header simplified: it no longer repeats the active sidebar item — the page title now only appears when the sidebar is collapsed.' },
      { type: 'changed', description: 'Tables, timers, and totals now use tabular numerals so digits align and no longer shift as values update.' },
      { type: 'changed', description: 'Every view refreshed to the new look — Tracker, Pomodoro, Timesheet, Reports, Invoice, Data, Settings, onboarding, and the date picker.' },
      { type: 'changed', description: 'Toast notifications redesigned as soft-tinted cards, and the sidebar timer widgets now use slimmer progress bars.' },
      { type: 'changed', description: 'Slimmer scrollbars, softer text selection color, and consistent keyboard focus outlines throughout the app.' },
      { type: 'changed', description: 'Inline editing no longer shifts text on switch — the textarea now inherits the same line height as the display element.' },
      { type: 'changed', description: 'Entry action buttons (continue, edit, merge) are smaller and top-aligned, keeping them out of the way of multi-line task names.' },
      { type: 'changed', description: 'Continue, pause, play, and stop buttons now use a soft tinted-background style (green, red) consistent with the breaks toggle.' },
      { type: 'changed', description: 'The pause button on an active entry sits on a white pill with a white border, lifting it cleanly off the green card background.' },
      { type: 'changed', description: 'Play and plus buttons are circular; the stop button is rounded to match the card language.' },
    ],
  },
  {
    version: '0.4.2',
    date: '2026-06-05',
    title: 'UI polish & empty states',
    changes: [
      { type: 'added', description: 'Reports now shows an icon and helpful message when no time or tasks have been tracked in the selected range.' },
      { type: 'added', description: 'Timesheet shows a notice banner when no hours have been logged for the current week.' },
      { type: 'changed', description: 'Sidebar timezone display now shows a friendly city name and UTC offset instead of the raw IANA timezone code.' },
      { type: 'changed', description: 'Removed the left-border highlight from the active sidebar tab for a cleaner look.' },
      { type: 'changed', description: 'Toasts now animate in and out with a slide and fade instead of appearing instantly.' },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-05-24',
    title: 'Stability & load fixes',
    changes: [
      { type: 'changed', description: 'Pomodoro timer defaults (work, short break, long break, sessions) and the daily hour goal are now defined in a single constants file, making future adjustments easier and more consistent.' },
      { type: 'fixed', description: 'App no longer appears frozen on first load — a spinner is shown while time entry data is being read from storage.' },
      { type: 'fixed', description: 'Weekly timesheet totals no longer produce incorrect values when an entry is missing a start time due to data corruption.' },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-05-19',
    title: 'Timesheet data moved to IndexedDB',
    changes: [
      { type: 'changed', description: 'Time entries and weekly timesheet data are now stored in IndexedDB instead of localStorage. This removes the 5–10 MB browser storage cap, so years of history no longer risk hitting the limit.' },
      { type: 'changed', description: 'Existing data is migrated automatically on first load — nothing to do on your end. Your entries will appear exactly as before.' },
      { type: 'added', description: 'Import/export and revert-import now use IndexedDB for backup storage as well, keeping all timesheet data out of the limited localStorage space.' },
      { type: 'fixed', description: 'Corrupt localStorage data detected during migration is now properly quarantined and surfaced in Data Recovery, consistent with how other storage errors are handled.' },
    ],
  },
  {
    version: '0.3.4',
    date: '2026-05-18',
    title: 'Interactive map for timezone selection',
    changes: [
      { type: 'added', description: 'Leaflet world map with city markers added to TimezoneSelect component used in Settings and Onboarding.' },
      { type: 'added', description: 'Notice for timezone usage for remote workers in Settings and Onboarding.' },
      { type: 'changed', description: 'Timezone selection in Settings and Onboarding now shows an interactive Leaflet world map — click a city marker to pick your timezone, or use the dropdown below the map.' },
    ],
  },
  {
    version: '0.3.3',
    date: '2026-05-15',
    title: 'Reports — Average now excludes non-work days',
    changes: [
      { type: 'fixed', description: 'Average per day in the Range Total card now divides by work days only, matching your Non-Work Days setting — weekends no longer drag the average down.' },
      { type: 'changed', description: 'Range stats (total, average, max) are now memoized and only recompute when data changes, not on every tooltip hover.' },
      { type: 'changed', description: 'Goal ring progress and dash offset are memoized, recomputing only when today\'s hours or the daily goal changes.' },
      { type: 'changed', description: 'Ring geometry constants (size, radius, circumference) moved to module level — no longer re-evaluated on every render.' },
      { type: 'changed', description: 'Streak calculation reuses the memoized weekend day set instead of allocating a redundant Set on each recalculation.' },
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

if (import.meta.env.DEV) {
  const seen = new Set();
  for (const entry of CHANGELOG) {
    if (seen.has(entry.version)) {
      throw new Error(`[changelog] Duplicate version string: "${entry.version}"`);
    }
    seen.add(entry.version);
  }
}
