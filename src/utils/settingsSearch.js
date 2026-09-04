// Index for the Settings page: what sections exist, what they're called, which
// category they live under, and the words people would search for to find them.
//
// Each entry mirrors one top-level card in Settings.jsx, keyed by the `id` that
// component passes to its `show()` helper. `keywords` exist so people can find
// a control using the words they'd actually type ("dark mode", "am/pm", "wipe")
// instead of only the heading it happens to live under, so it's worth listing
// the field labels and synonyms, not just the title again.
//
// WHEN YOU ADD A SECTION to Settings.jsx, add it here too, with a `category`:
// an unindexed section can never match, so it would vanish the moment anyone
// typed in the search box, and a section with no category would never be
// reachable from the sidebar rail.

// The groups the page is split into, in the order the rail lists them. Keeping
// each group to a handful of cards is the point — the whole page as one column
// was too much to scan.
export const SETTINGS_CATEGORIES = [
  {
    id: 'general',
    label: 'General',
    description: 'Where you are, how time is shown, and the shape of your week.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme, sidebar layout, and the colors on your charts.',
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Your workspaces, an optional cloud account, and syncing across devices.',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Back up and restore your data, recover it, or start over.',
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version, release notes, source code, and credits.',
  },
];

export const DEFAULT_SETTINGS_CATEGORY = 'general';

export const SETTINGS_SECTIONS = [
  {
    id: 'account',
    title: 'Account & Sync',
    category: 'account',
    keywords: [
      'account', 'sync', 'cloud', 'sign in', 'signin', 'log in', 'login', 'sign out',
      'email', 'magic link', 'password', 'supabase', 'backup', 'cross device',
      'devices', 'online', 'offline',
    ],
  },
  {
    id: 'workspaces',
    title: 'Workspaces',
    category: 'account',
    keywords: [
      'workspace', 'workspaces', 'manage workspaces', 'switch workspace', 'rename workspace',
      'delete workspace', 'new workspace', 'create workspace', 'client', 'clients', 'project',
      'projects', 'profile', 'profiles', 'separate', 'multiple', 'job', 'jobs', 'company',
      'switcher', 'active workspace',
    ],
  },
  {
    id: 'recovery',
    title: 'Data Recovery',
    category: 'data',
    keywords: [
      'data recovery', 'recover', 'corrupt', 'corrupted', 'quarantine', 'quarantined',
      'restore', 'discard', 'backup', 'unparseable', 'broken', 'repair',
    ],
  },
  {
    id: 'timezone',
    title: 'Timezone Settings',
    category: 'general',
    keywords: [
      'timezone', 'time zone', 'tz', 'utc', 'gmt', 'offset', 'region', 'country',
      'city', 'location', 'remote', 'local time', 'business hours',
    ],
  },
  {
    id: 'clock',
    title: 'Clock Format',
    category: 'general',
    keywords: [
      'clock', 'clock format', 'time format', '12 hour', '24 hour', 'am pm', 'military time',
      'date format', 'date display', 'iso', 'numeric', 'day month year', 'weekday',
      'navigation bar', 'navbar', 'time only',
    ],
  },
  {
    id: 'schedule',
    title: 'Work Schedule',
    category: 'general',
    keywords: [
      'work schedule', 'week start', 'start of week', 'first day of week', 'sunday', 'monday',
      'weekend', 'weekend days', 'non work days', 'days off', 'holiday', 'streak',
      'daily hours goal', 'hour goal', 'target hours', 'hours per day', 'goal ring',
    ],
  },
  {
    id: 'goal-alert',
    title: 'Goal Alert',
    category: 'general',
    keywords: [
      'goal alert', 'alert', 'alarm', 'sound', 'sounds', 'chime', 'ping', 'bell',
      'beep', 'notify', 'notification', 'notifications', 'audio', 'noise', 'tone',
      'ringtone', 'volume', 'mute', 'silent', 'play', 'custom sound', 'upload sound',
      'sound file', 'mp3', 'wav', 'daily goal', 'hour goal', 'goal reached',
      'reminder', 'remind me', 'overtime', 'repeat',
    ],
  },
  {
    id: 'heatmap',
    title: 'Heatmap Colors',
    category: 'appearance',
    keywords: [
      'heatmap', 'heat map', 'colors', 'colours', 'color stops', 'progress stops',
      'gradient', 'palette', 'goal met', 'completion color', 'empty color',
      'no time tracked', 'reports', 'contribution graph',
    ],
  },
  {
    id: 'goalring',
    title: 'Goal Ring Colors',
    category: 'appearance',
    keywords: [
      'goal ring', 'ring', 'progress ring', 'donut', 'colors', 'colours',
      'in progress color', 'completion color', 'goal met', 'reports', 'palette',
    ],
  },
  {
    id: 'save',
    title: 'Save Changes',
    category: 'general',
    keywords: ['save', 'save settings', 'apply', 'apply changes', 'confirm', 'unsaved'],
  },
  {
    id: 'data-management',
    title: 'Import & Export',
    category: 'data',
    keywords: [
      'import', 'export', 'data management', 'backup', 'back up', 'restore', 'json',
      'file', 'download', 'upload', 'save to file', 'merge', 'replace', 'revert',
      'undo import', 'selective', 'weekly', 'daily', 'transfer', 'migrate',
      'move to another device', 'clear all', 'clear entries', 'clear timesheet data',
      'delete entries', 'timesheet data', 'tracker data',
    ],
  },
  {
    id: 'reset-onboarding',
    title: 'Reset Onboarding',
    category: 'data',
    keywords: [
      'onboarding', 'reset onboarding', 'setup', 'set up', 'welcome', 'welcome screen',
      'tutorial', 'walkthrough', 'intro', 'first run', 'getting started', 'preview',
    ],
  },
  {
    id: 'clear-data',
    title: 'Reset Everything',
    category: 'data',
    keywords: [
      'reset everything', 'reset all', 'app wide', 'clear all data', 'clear', 'delete',
      'delete everything', 'erase', 'wipe', 'remove', 'reset app', 'factory reset',
      'start over', 'start fresh', 'preferences', 'settings', 'entries', 'danger',
      'destructive', 'nuke',
    ],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    category: 'appearance',
    keywords: [
      'appearance', 'theme', 'dark mode', 'darkmode', 'light mode', 'night mode',
      'system theme', 'color scheme', 'contrast', 'looks', 'style',
      'dark style', 'dark tone', 'midnight', 'charcoal', 'black', 'true black',
      'amoled', 'oled', 'gray', 'grey', 'neutral', 'blue tint', 'tinted',
    ],
  },
  {
    id: 'sidebar',
    title: 'Sidebar Items',
    category: 'appearance',
    keywords: [
      'sidebar', 'side bar', 'sidebar items', 'navigation', 'nav', 'nav items', 'menu',
      'reorder', 'rearrange', 'order', 'sort', 'move', 'drag', 'drag and drop',
      'hide', 'hidden', 'show', 'disable', 'enable', 'toggle', 'remove', 'customize',
      'layout', 'tabs', 'views', 'pages', 'tracker', 'pomodoro', 'timesheet',
      'reports', 'invoice', 'data',
    ],
  },
  {
    id: 'about',
    title: 'About',
    category: 'about',
    keywords: [
      'about', 'version', 'release', 'changelog', 'what is new', 'github', 'repo',
      'repository', 'source', 'open source', 'star', 'license', 'credits', 'author',
      'userkace', 'kronos',
    ],
  },
  {
    id: 'release-notes',
    title: 'Release Notes',
    category: 'about',
    keywords: [
      'release notes', 'releases', 'changelog', 'change log', 'what is new', 'whats new',
      'updates', 'update', 'version history', 'history', 'new features', 'fixes', 'patch notes',
    ],
  },
];

const CATEGORY_OF_SECTION = new Map(SETTINGS_SECTIONS.map(s => [s.id, s.category]));

/** The category a section belongs to, or null if it isn't indexed. */
export const sectionCategory = (id) => CATEGORY_OF_SECTION.get(id) ?? null;

/** Ids of every section in a category, in page order. */
export const sectionsInCategory = (categoryId) =>
  SETTINGS_SECTIONS.filter(s => s.category === categoryId).map(s => s.id);

// Punctuation and case are noise here: it lets "12-hour", "12 hour" and
// "12hour"-adjacent typing all reach the same section.
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const HAYSTACKS = SETTINGS_SECTIONS.map(({ id, title, keywords }) => ({
  id,
  text: normalize([title, ...keywords].join(' ')),
}));

const ALL_IDS = SETTINGS_SECTIONS.map(s => s.id);

/**
 * Ids of the sections matching `query`. Every whitespace-separated term must
 * appear somewhere in a section's title or keywords (AND, not OR), so extra
 * words narrow the list the way people expect. An empty query matches all.
 */
export const matchSettingsSections = (query) => {
  const terms = normalize(query || '').split(' ').filter(Boolean);
  if (terms.length === 0) return new Set(ALL_IDS);
  return new Set(
    HAYSTACKS
      .filter(({ text }) => terms.every(term => text.includes(term)))
      .map(({ id }) => id)
  );
};
