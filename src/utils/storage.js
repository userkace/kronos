// LocalStorage utility functions for the Time Tracking Application

const STORAGE_KEYS = {
  TIMESHEET_DATA: 'kronos_timesheet_data',
  SELECTED_TIMEZONE: 'kronos_selected_timezone',
  SELECTED_WEEK: 'kronos_selected_week',
  WEEKLY_TIMESHEET: 'kronos_weekly_timesheet',
  WEEK_START: 'kronos_week_start',
  ONBOARDING_COMPLETED: 'kronos_onboarding_completed',
  CLOCK_FORMAT: 'kronos_clock_format',
  SIDEBAR_STATE: 'kronos_sidebar_state',
  SORT_ORDER: 'kronos_sort_order',
  SHOW_BREAKS: 'kronos_show_breaks',
  INVOICE_SETTINGS: 'kronos_invoice_settings',
  CHANGELOG_LAST_SEEN: 'kronos_changelog_last_seen_version',
  DAILY_HOUR_GOAL: 'kronos_daily_hour_goal',
  WEEKEND_DAYS: 'kronos_weekend_days',
  HEATMAP_COLORS: 'kronos_heatmap_colors',
  GOAL_RING_COLORS: 'kronos_goal_ring_colors',
  DATE_FORMAT: 'kronos_date_format',
};

const DEFAULT_DAILY_HOUR_GOAL = 8;
// Day-of-week numbers (0=Sun..6=Sat) that don't break the streak when zero.
const DEFAULT_WEEKEND_DAYS = [0, 6];

export const DEFAULT_GOAL_RING_COLORS = {
  progressColor: '#2563eb',
  completionColor: '#16a34a',
};

export const DEFAULT_HEATMAP_COLORS = {
  emptyColor: '#e5e7eb',
  stops: [
    { upTo: 33, color: '#bfdbfe' },
    { upTo: 66, color: '#60a5fa' },
    { upTo: 100, color: '#2563eb' },
  ],
  completionColor: '#1e40af',
};

const isValidColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

const isValidHeatmapColors = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (!isValidColor(obj.emptyColor) || !isValidColor(obj.completionColor)) return false;
  if (!Array.isArray(obj.stops) || obj.stops.length === 0) return false;
  const sorted = [...obj.stops].sort((a, b) => a.upTo - b.upTo);
  if (sorted[sorted.length - 1].upTo !== 100) return false;
  return sorted.every(
    s => typeof s.upTo === 'number' && Number.isInteger(s.upTo) &&
         s.upTo >= 1 && s.upTo <= 100 && isValidColor(s.color)
  );
};

const sanitizeWeekendDays = (days) => Array.from(new Set(
  (Array.isArray(days) ? days : [])
    .map(Number)
    .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
)).sort((a, b) => a - b);

const CORRUPT_BACKUP_PREFIX = '__kronos_corrupt_';
const CORRUPT_PENDING_KEY = '__kronos_corrupt_pending';

// Read the set of original-keys that have unresolved corruption. Saves to any
// key in this set are refused so we don't overwrite the user's quarantined
// blob with whatever default the app would otherwise produce.
const readPendingSet = () => {
  try {
    const raw = localStorage.getItem(CORRUPT_PENDING_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writePendingSet = (set) => {
  try {
    if (set.size === 0) {
      localStorage.removeItem(CORRUPT_PENDING_KEY);
    } else {
      localStorage.setItem(CORRUPT_PENDING_KEY, JSON.stringify([...set]));
    }
  } catch (e) {
    console.error('Failed to update corruption pending set:', e);
  }
};

const isKeyCorruptPending = (key) => readPendingSet().has(key);

// When a load function encounters unparseable JSON, copy the raw bytes to a
// timestamped backup key and mark the original key as pending so subsequent
// saves can't clobber what's left.
const quarantineCorruption = (key, rawValue) => {
  if (rawValue == null) return;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    localStorage.setItem(`${CORRUPT_BACKUP_PREFIX}${key}_${ts}`, rawValue);
    const pending = readPendingSet();
    pending.add(key);
    writePendingSet(pending);
  } catch (e) {
    console.error('Failed to quarantine corrupt data for', key, e);
  }
};

// Enumerate the keys that need user resolution before saves can resume.
export const getCorruptPendingKeys = () => [...readPendingSet()];

// Enumerate every quarantine backup with metadata for the recovery UI.
// A single original key may have multiple backups if corruption recurs.
export const getCorruptionBackupsDetailed = () => {
  const backups = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CORRUPT_BACKUP_PREFIX)) continue;

      const rest = key.slice(CORRUPT_BACKUP_PREFIX.length);
      // Backup keys look like: __kronos_corrupt_<originalKey>_<isoTimestamp>.
      // Split on the LAST underscore-block that looks like a timestamp.
      const tsMatch = rest.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)$/);
      const originalKey = tsMatch ? rest.slice(0, -tsMatch[0].length) : rest;
      const timestamp = tsMatch ? tsMatch[1].replace(/-/g, ':').replace('T', ' ').slice(0, 19) : null;
      const raw = localStorage.getItem(key) || '';

      backups.push({
        backupKey: key,
        originalKey,
        timestamp,
        sizeBytes: raw.length,
      });
    }
  } catch (e) {
    console.error('Error enumerating corruption backups:', e);
  }
  return backups.sort((a, b) => a.backupKey.localeCompare(b.backupKey));
};

// Read the raw stored bytes for a quarantine backup so callers can download
// them as a blob.
export const getQuarantineRaw = (backupKey) => {
  try {
    return localStorage.getItem(backupKey);
  } catch (e) {
    console.error('Failed to read quarantine raw bytes:', e);
    return null;
  }
};

// Replace the original key's value with the contents of a quarantine backup.
// Validates that the backup parses as JSON before overwriting, otherwise the
// recovery would re-corrupt the original. Returns true on success.
export const restoreFromQuarantine = (backupKey) => {
  try {
    const raw = localStorage.getItem(backupKey);
    if (raw == null) return false;
    JSON.parse(raw); // throws if still unparseable

    const rest = backupKey.slice(CORRUPT_BACKUP_PREFIX.length);
    const tsMatch = rest.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)$/);
    const originalKey = tsMatch ? rest.slice(0, -tsMatch[0].length) : rest;

    localStorage.setItem(originalKey, raw);
    localStorage.removeItem(backupKey);

    const pending = readPendingSet();
    pending.delete(originalKey);
    writePendingSet(pending);
    return true;
  } catch (e) {
    console.error('Restore from quarantine failed:', e);
    return false;
  }
};

// Drop a quarantine backup AND clear the pending flag for its original key.
// Used when the user has decided to start fresh and abandon the corrupt blob.
export const discardQuarantine = (backupKey) => {
  try {
    const rest = backupKey.slice(CORRUPT_BACKUP_PREFIX.length);
    const tsMatch = rest.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)$/);
    const originalKey = tsMatch ? rest.slice(0, -tsMatch[0].length) : rest;

    localStorage.removeItem(backupKey);

    // Only clear pending if no other backup for this key remains; recurrent
    // corruption shouldn't be silently un-flagged.
    const stillHasBackup = getCorruptionBackupsDetailed().some(
      b => b.originalKey === originalKey
    );
    if (!stillHasBackup) {
      const pending = readPendingSet();
      pending.delete(originalKey);
      writePendingSet(pending);
    }
    return true;
  } catch (e) {
    console.error('Discard quarantine failed:', e);
    return false;
  }
};

// Save timesheet data to LocalStorage
export const saveTimesheetData = (data) => {
  if (isKeyCorruptPending(STORAGE_KEYS.TIMESHEET_DATA)) {
    console.warn(
      'Refused saveTimesheetData: corruption pending for ' +
      STORAGE_KEYS.TIMESHEET_DATA + '. Resolve in Settings → Data Recovery.'
    );
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.TIMESHEET_DATA, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving timesheet data:', error);
    return false;
  }
};

// Load timesheet data from LocalStorage
export const loadTimesheetData = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.TIMESHEET_DATA);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading timesheet data:', error);
    quarantineCorruption(STORAGE_KEYS.TIMESHEET_DATA, stored);
    return {};
  }
};

// Save selected timezone to LocalStorage
export const saveTimezone = (timezone) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_TIMEZONE, timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
};

// Load selected timezone from LocalStorage
export const loadTimezone = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_TIMEZONE);
    return stored || null; // Return null instead of 'UTC' default
  } catch (error) {
    console.error('Error loading timezone:', error);
    return null;
  }
};

// Save selected week to LocalStorage
export const saveSelectedWeek = (date) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_WEEK, date.toISOString());
  } catch (error) {
    console.error('Error saving selected week:', error);
  }
};

// Load selected week from LocalStorage
export const loadSelectedWeek = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_WEEK);
    return stored ? new Date(stored) : new Date();
  } catch (error) {
    console.error('Error loading selected week:', error);
    return new Date();
  }
};

// Clear all application data from LocalStorage
export const clearAllData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// Save weekly timesheet data to LocalStorage
export const saveWeeklyTimesheet = (data) => {
  if (isKeyCorruptPending(STORAGE_KEYS.WEEKLY_TIMESHEET)) {
    console.warn(
      'Refused saveWeeklyTimesheet: corruption pending for ' +
      STORAGE_KEYS.WEEKLY_TIMESHEET + '. Resolve in Settings → Data Recovery.'
    );
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_TIMESHEET, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving weekly timesheet data:', error);
    return false;
  }
};

// Load weekly timesheet data from LocalStorage
export const loadWeeklyTimesheet = () => {
  const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_TIMESHEET);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading weekly timesheet data:', error);
    quarantineCorruption(STORAGE_KEYS.WEEKLY_TIMESHEET, data);
    return {};
  }
};

// Save week start preference to LocalStorage
export const saveWeekStart = (weekStart) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WEEK_START, weekStart);
  } catch (error) {
    console.error('Error saving week start:', error);
  }
};

// Load week start preference from LocalStorage
export const loadWeekStart = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.WEEK_START) || 'sunday';
  } catch (error) {
    console.error('Error loading week start:', error);
    return 'sunday';
  }
};

// Save onboarding completion status to LocalStorage
export const saveOnboardingCompleted = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
  } catch (error) {
    console.error('Error saving onboarding status:', error);
  }
};

// Load onboarding completion status from LocalStorage
export const loadOnboardingCompleted = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
  } catch (error) {
    console.error('Error loading onboarding status:', error);
    return false;
  }
};

export const saveDateFormat = (dateFormat) => {
  try {
    localStorage.setItem(STORAGE_KEYS.DATE_FORMAT, dateFormat);
  } catch (error) {
    console.error('Error saving date format:', error);
  }
};

export const loadDateFormat = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.DATE_FORMAT) || 'short';
  } catch (error) {
    console.error('Error loading date format:', error);
    return 'short';
  }
};

// Save clock format preference to LocalStorage
export const saveClockFormat = (clockFormat) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CLOCK_FORMAT, clockFormat);
  } catch (error) {
    console.error('Error saving clock format:', error);
  }
};

// Load clock format preference from LocalStorage
export const loadClockFormat = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CLOCK_FORMAT) || '12hour'; // Default to 12-hour format
  } catch (error) {
    console.error('Error loading clock format:', error);
    return '12hour';
  }
};

// Save sidebar state to LocalStorage
export const saveSidebarState = (isOpen) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, JSON.stringify(isOpen));
  } catch (error) {
    console.error('Error saving sidebar state:', error);
  }
};

/**
 * Loads the sidebar state from LocalStorage
 * @returns {boolean} - Returns true if the sidebar should be open, false otherwise
 */
export const loadSidebarState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE);
    // Handle both old object format and new boolean format for backward compatibility
    if (saved) {
      const parsed = JSON.parse(saved);
      return typeof parsed === 'object' ? parsed.isOpen !== false : parsed !== false;
    }
    return true; // Default to open
  } catch (error) {
    console.error('Error loading sidebar state:', error);
    return true; // Default to open on error
  }
};

// Save sort order preference to LocalStorage
export const saveSortOrder = (sortOrder) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, JSON.stringify(sortOrder));
  } catch (error) {
    console.error('Error saving sort order:', error);
  }
};

// Load sort order preference from LocalStorage
export const loadSortOrder = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SORT_ORDER);
    return stored !== null ? JSON.parse(stored) : 'desc'; // Default to descending (newest first)
  } catch (error) {
    console.error('Error loading sort order:', error);
    return 'desc'; // Default to descending on error
  }
};

// Save daily hour goal (whole-number hours) to LocalStorage
export const saveDailyHourGoal = (hours) => {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_HOUR_GOAL, JSON.stringify(hours));
  } catch (error) {
    console.error('Error saving daily hour goal:', error);
  }
};

// Load daily hour goal. Falls back to 8h on missing/corrupt values rather
// than quarantining — a bad number here is harmless and a fresh default is
// the best UX for a settings field.
export const loadDailyHourGoal = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DAILY_HOUR_GOAL);
    if (stored == null) return DEFAULT_DAILY_HOUR_GOAL;
    const parsed = JSON.parse(stored);
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_DAILY_HOUR_GOAL;
  } catch (error) {
    console.error('Error loading daily hour goal:', error);
    return DEFAULT_DAILY_HOUR_GOAL;
  }
};

// Save weekend / non-work days (array of 0..6 where 0=Sun) to LocalStorage.
// An empty array is valid — it means "no day is a weekend, every gap breaks
// the streak." Invalid entries are silently dropped via sanitizeWeekendDays.
export const saveWeekendDays = (days) => {
  try {
    const cleaned = sanitizeWeekendDays(days);
    localStorage.setItem(STORAGE_KEYS.WEEKEND_DAYS, JSON.stringify(cleaned));
  } catch (error) {
    console.error('Error saving weekend days:', error);
  }
};

// Load weekend days. Falls back to [Sun, Sat] on missing/corrupt — a bad
// value here is harmless and the default is the most-common preference.
export const loadWeekendDays = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WEEKEND_DAYS);
    if (stored == null) return [...DEFAULT_WEEKEND_DAYS];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [...DEFAULT_WEEKEND_DAYS];
    return sanitizeWeekendDays(parsed);
  } catch (error) {
    console.error('Error loading weekend days:', error);
    return [...DEFAULT_WEEKEND_DAYS];
  }
};

export const saveHeatmapColors = (colors) => {
  try {
    localStorage.setItem(STORAGE_KEYS.HEATMAP_COLORS, JSON.stringify(colors));
  } catch (error) {
    console.error('Error saving heatmap colors:', error);
  }
};

export const loadHeatmapColors = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HEATMAP_COLORS);
    if (stored == null) return JSON.parse(JSON.stringify(DEFAULT_HEATMAP_COLORS));
    const parsed = JSON.parse(stored);
    return isValidHeatmapColors(parsed)
      ? parsed
      : JSON.parse(JSON.stringify(DEFAULT_HEATMAP_COLORS));
  } catch (error) {
    console.error('Error loading heatmap colors:', error);
    return JSON.parse(JSON.stringify(DEFAULT_HEATMAP_COLORS));
  }
};

export const saveGoalRingColors = (colors) => {
  try {
    localStorage.setItem(STORAGE_KEYS.GOAL_RING_COLORS, JSON.stringify(colors));
  } catch (error) {
    console.error('Error saving goal ring colors:', error);
  }
};

export const loadGoalRingColors = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GOAL_RING_COLORS);
    if (stored == null) return { ...DEFAULT_GOAL_RING_COLORS };
    const parsed = JSON.parse(stored);
    if (
      parsed && typeof parsed === 'object' &&
      isValidColor(parsed.progressColor) &&
      isValidColor(parsed.completionColor)
    ) return parsed;
    return { ...DEFAULT_GOAL_RING_COLORS };
  } catch (error) {
    console.error('Error loading goal ring colors:', error);
    return { ...DEFAULT_GOAL_RING_COLORS };
  }
};

// Save break visibility preference to LocalStorage
export const saveShowBreaks = (showBreaks) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SHOW_BREAKS, JSON.stringify(showBreaks));
  } catch (error) {
    console.error('Error saving show breaks preference:', error);
  }
};

// Load break visibility preference from LocalStorage
export const loadShowBreaks = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SHOW_BREAKS);
    return stored !== null ? JSON.parse(stored) : true; // Default to true (show breaks)
  } catch (error) {
    console.error('Error loading show breaks preference:', error);
    return true; // Default to showing breaks on error
  }
};

// Save invoice settings to LocalStorage (only persistent settings, not invoice-specific data)
export const saveInvoiceSettings = (settings) => {
  if (isKeyCorruptPending(STORAGE_KEYS.INVOICE_SETTINGS)) {
    console.warn(
      'Refused saveInvoiceSettings: corruption pending for ' +
      STORAGE_KEYS.INVOICE_SETTINGS + '. Resolve in Settings → Data Recovery.'
    );
    return false;
  }
  try {
    // Only save business info, client info, rate, and currency
    // Exclude invoice number and dates as these change per invoice
    const persistentSettings = {
      userName: settings.userName,
      userAddress: settings.userAddress,
      userEmail: settings.userEmail,
      clientName: settings.clientName,
      clientAddress: settings.clientAddress,
      hourlyRate: settings.hourlyRate,
      currency: settings.currency
    };
    localStorage.setItem(STORAGE_KEYS.INVOICE_SETTINGS, JSON.stringify(persistentSettings));
    return true;
  } catch (error) {
    console.error('Error saving invoice settings:', error);
    return false;
  }
};

// Load invoice settings from LocalStorage
export const loadInvoiceSettings = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.INVOICE_SETTINGS);
  let persistentSettings = {};
  if (stored) {
    try {
      persistentSettings = JSON.parse(stored);
    } catch (error) {
      console.error('Error loading invoice settings:', error);
      quarantineCorruption(STORAGE_KEYS.INVOICE_SETTINGS, stored);
    }
  }
  try {
    return {
      // Persistent settings (loaded from storage)
      userName: persistentSettings.userName || '',
      userAddress: persistentSettings.userAddress || '',
      userEmail: persistentSettings.userEmail || '',
      clientName: persistentSettings.clientName || '',
      clientAddress: persistentSettings.clientAddress || '',
      hourlyRate: persistentSettings.hourlyRate || 50,
      currency: persistentSettings.currency || 'USD',
      // Invoice-specific fields (generated fresh each time)
      invoiceNumber: '',
      startDate: '',
      endDate: ''
    };
  } catch (error) {
    console.error('Error loading invoice settings:', error);
    return {
      // Persistent settings (defaults)
      userName: '',
      userAddress: '',
      userEmail: '',
      clientName: '',
      clientAddress: '',
      hourlyRate: 50,
      currency: 'USD',
      // Invoice-specific fields (defaults)
      invoiceNumber: '',
      startDate: '',
      endDate: ''
    };
  }
};

// Persistence for the "What's new" modal trigger.
//
// Returns null when nothing has been recorded — callers MUST distinguish that
// from "any other value", because we use `null` as the signal that this is a
// fresh install that should be seeded silently rather than greeted with the
// modal. The value is now a free-form version string (e.g. '0.21.1') chosen
// by whoever maintains src/data/changelog.js — comparison is string equality.
export const loadChangelogLastSeenVersion = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHANGELOG_LAST_SEEN);
    return raw == null ? null : String(raw);
  } catch (e) {
    console.error('Error loading changelog last-seen version:', e);
    return null;
  }
};

export const saveChangelogLastSeenVersion = (version) => {
  try {
    if (version == null) return;
    localStorage.setItem(STORAGE_KEYS.CHANGELOG_LAST_SEEN, String(version));
  } catch (e) {
    console.error('Error saving changelog last-seen version:', e);
  }
};
