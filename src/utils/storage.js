// LocalStorage utility functions for the Time Tracking Application
// Timesheet data (kronos_timesheet_data, kronos_weekly_timesheet) is stored in
// IndexedDB via a write-behind in-memory cache. All other keys remain in localStorage.

import { idbGet, idbSet, idbDelete } from './timesheetDB';
import storageEventSystem from './storageEvents';
import { DEFAULT_DAILY_HOUR_GOAL } from '../constants/defaults';

// In-memory cache for IDB-backed keys. Populated once by initTimesheetStorage()
// before first read; all load functions read from here, all save functions
// update here synchronously then flush to IDB asynchronously.
let _timesheetCache = null;
let _weeklyCache = null;
let _initPromise = null;
// Last-emitted JSON snapshots — used to suppress re-emits when a save produces
// identical content (e.g. the save→subscribe→loadData→setState→save cycle in
// DailyTracker). Matches the de-duplication the old localStorage path got for
// free from storageEvents.detectChanges(oldString, newString).
let _timesheetLastEmittedJson = null;
let _weeklyLastEmittedJson = null;

// Use string literals here so this function can run before STORAGE_KEYS is declared.
const IDB_KEY_TIMESHEET = 'kronos_timesheet_data';
const IDB_KEY_WEEKLY    = 'kronos_weekly_timesheet';

// ── Workspaces ───────────────────────────────────────────────────────────
// A workspace isolates one freelancer-client's data — time logs, weekly
// summary, invoice settings, timezone, and display preferences. The DEFAULT
// workspace deliberately reuses the original (un-suffixed) storage keys so
// that pre-workspace data is adopted by it with zero migration; every other
// workspace namespaces its keys with `__ws_<id>`.
//
// The workspace list and the active-workspace pointer are themselves global
// (never namespaced), as are onboarding, sidebar, changelog, and Pomodoro
// state — those are app-wide, not per-client.
export const WORKSPACE_DEFAULT_ID = 'default';
const WORKSPACES_KEY = 'kronos_workspaces';
const ACTIVE_WORKSPACE_KEY = 'kronos_active_workspace';

// Cached so the synchronous key resolver doesn't hit localStorage on every
// read/write. Populated lazily by getActiveWorkspaceId().
let _activeWorkspaceId = null;

export const getActiveWorkspaceId = () => {
  if (_activeWorkspaceId) return _activeWorkspaceId;
  try {
    _activeWorkspaceId = localStorage.getItem(ACTIVE_WORKSPACE_KEY) || WORKSPACE_DEFAULT_ID;
  } catch {
    _activeWorkspaceId = WORKSPACE_DEFAULT_ID;
  }
  return _activeWorkspaceId;
};

// Resolve a base storage key to the active workspace. Default workspace keeps
// the bare key (retroactive adoption of existing data); others get suffixed.
const wsKey = (baseKey) => wsKeyFor(baseKey, getActiveWorkspaceId());
// Exported so the sync engine can compute the on-disk key for any workspace
// (including non-active ones) when pulling cloud data into local storage.
export const wsKeyFor = (baseKey, id) =>
  id === WORKSPACE_DEFAULT_ID ? baseKey : `${baseKey}__ws_${id}`;

export const loadWorkspaces = () => {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    if (!raw) return [{ id: WORKSPACE_DEFAULT_ID, name: 'Default workspace' }];
    const parsed = JSON.parse(raw);
    const cleaned = Array.isArray(parsed)
      ? parsed.filter(w => w && typeof w.id === 'string' && typeof w.name === 'string')
      : [];
    return cleaned.length > 0 ? cleaned : [{ id: WORKSPACE_DEFAULT_ID, name: 'Default workspace' }];
  } catch (e) {
    console.error('Error loading workspaces:', e);
    return [{ id: WORKSPACE_DEFAULT_ID, name: 'Default workspace' }];
  }
};

export const saveWorkspaces = (list) => {
  try {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving workspaces:', e);
  }
};

// Point the storage layer at a different workspace and reload the IDB-backed
// in-memory caches so subsequent loadTimesheetData/loadWeeklyTimesheet calls
// return the new workspace's data. localStorage-backed preferences are read
// fresh by their own load functions via wsKey, so they need no cache reload.
// Callers typically reload the app afterwards to re-init React contexts.
export const setActiveWorkspace = async (id) => {
  _activeWorkspaceId = id;
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  } catch (e) {
    console.error('Error saving active workspace:', e);
  }
  _timesheetLastEmittedJson = null;
  _weeklyLastEmittedJson = null;
  _timesheetCache = (await idbGet(wsKeyFor(IDB_KEY_TIMESHEET, id))) ?? {};
  _weeklyCache = (await idbGet(wsKeyFor(IDB_KEY_WEEKLY, id))) ?? {};
};

// The localStorage base keys that hold per-workspace preferences. The two
// IDB-backed keys (timesheet, weekly) are handled separately below.
const WORKSPACE_SCOPED_LS_KEYS = [
  'kronos_selected_timezone',
  'kronos_selected_week',
  'kronos_week_start',
  'kronos_clock_format',
  'kronos_sort_order',
  'kronos_show_breaks',
  'kronos_invoice_settings',
  'kronos_daily_hour_goal',
  'kronos_weekend_days',
  'kronos_heatmap_colors',
  'kronos_goal_ring_colors',
  'kronos_date_format',
];

// Permanently delete every scoped store belonging to a workspace. Used when a
// workspace is deleted. The default workspace's data lives in the bare keys,
// so wsKeyFor handles both the suffixed and un-suffixed cases.
export const deleteWorkspaceData = async (id) => {
  try {
    WORKSPACE_SCOPED_LS_KEYS.forEach(base => {
      localStorage.removeItem(wsKeyFor(base, id));
    });
  } catch (e) {
    console.error('Error clearing workspace localStorage:', e);
  }
  try {
    await idbDelete(wsKeyFor(IDB_KEY_TIMESHEET, id));
    await idbDelete(wsKeyFor(IDB_KEY_WEEKLY, id));
  } catch (e) {
    console.error('Error clearing workspace IDB data:', e);
  }
};

const _doInitTimesheetStorage = async () => {
  const migrateKey = async (lsKey) => {
    const raw = localStorage.getItem(lsKey);
    if (raw != null) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Corrupt JSON — leave it in localStorage so the quarantine path
        // picks it up on the next explicit load call.
        return await idbGet(lsKey) ?? {};
      }
      // Parsed successfully — write to IDB. If IDB fails we still return
      // the parsed value so the session works; localStorage remains as a
      // retry source on the next reload.
      try {
        await idbSet(lsKey, parsed);
        localStorage.removeItem(lsKey);
      } catch (idbErr) {
        console.error('IDB migration write failed for', lsKey, idbErr);
      }
      return parsed;
    }
    return await idbGet(lsKey) ?? {};
  };

  // Resolve to the active workspace. For the default workspace these are the
  // bare keys, so existing pre-workspace data migrates and loads exactly as
  // before. Other workspaces load their suffixed keys (no localStorage to
  // migrate — they were created after the IDB switch).
  _timesheetCache = await migrateKey(wsKey(IDB_KEY_TIMESHEET));
  _weeklyCache    = await migrateKey(wsKey(IDB_KEY_WEEKLY));
};

export const initTimesheetStorage = () => {
  if (!_initPromise) _initPromise = _doInitTimesheetStorage();
  return _initPromise;
};

// Kick off the IDB open early so it's likely resolved by the time React mounts.
_initPromise = _doInitTimesheetStorage();

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

// Save timesheet data to IndexedDB (write-behind cache)
export const saveTimesheetData = (data) => {
  if (isKeyCorruptPending(STORAGE_KEYS.TIMESHEET_DATA)) {
    console.warn(
      'Refused saveTimesheetData: corruption pending for ' +
      STORAGE_KEYS.TIMESHEET_DATA + '. Resolve in Settings → Data Recovery.'
    );
    return false;
  }
  // Always assign a new object so React subscribers detect the change via
  // reference inequality (callers often mutate the object they got from
  // loadTimesheetData() before passing it back here, keeping the same ref).
  _timesheetCache = data === _timesheetCache ? { ...data } : data;
  idbSet(wsKey(STORAGE_KEYS.TIMESHEET_DATA), _timesheetCache).catch(err =>
    console.error('IDB write failed for timesheet data:', err)
  );
  const json = JSON.stringify(_timesheetCache);
  if (json !== _timesheetLastEmittedJson) {
    _timesheetLastEmittedJson = json;
    queueMicrotask(() => storageEventSystem.emit(STORAGE_KEYS.TIMESHEET_DATA, {
      key: STORAGE_KEYS.TIMESHEET_DATA, oldValue: null, newValue: null,
    }));
  }
  return true;
};

// Load timesheet data from the in-memory cache (populated by initTimesheetStorage)
export const loadTimesheetData = () => _timesheetCache ?? {};

// Save selected timezone to LocalStorage
export const saveTimezone = (timezone) => {
  try {
    localStorage.setItem(wsKey(STORAGE_KEYS.SELECTED_TIMEZONE), timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
};

// Load selected timezone from LocalStorage
export const loadTimezone = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.SELECTED_TIMEZONE));
    return stored || null; // Return null instead of 'UTC' default
  } catch (error) {
    console.error('Error loading timezone:', error);
    return null;
  }
};

// Load the saved timezone for a specific workspace (not necessarily the active
// one) — the sync conflict dialog can show entries from any workspace. Falls
// back to the device's local timezone when that workspace has none saved.
export const loadTimezoneForWorkspace = (workspaceId) => {
  try {
    const stored = localStorage.getItem(wsKeyFor(STORAGE_KEYS.SELECTED_TIMEZONE, workspaceId));
    if (stored) return stored;
  } catch (error) {
    console.error('Error loading workspace timezone:', error);
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Save selected week to LocalStorage
export const saveSelectedWeek = (date) => {
  try {
    localStorage.setItem(wsKey(STORAGE_KEYS.SELECTED_WEEK), date.toISOString());
  } catch (error) {
    console.error('Error saving selected week:', error);
  }
};

// Load selected week from LocalStorage
export const loadSelectedWeek = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.SELECTED_WEEK));
    return stored ? new Date(stored) : new Date();
  } catch (error) {
    console.error('Error loading selected week:', error);
    return new Date();
  }
};

// Clear all application data from localStorage and IndexedDB
export const clearAllData = () => {
  try {
    // Scoped keys are cleared for the active workspace only; global keys
    // (onboarding, sidebar, changelog) are cleared outright.
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(WORKSPACE_SCOPED_LS_KEYS.includes(key) ? wsKey(key) : key);
    });
  } catch (error) {
    console.error('Error clearing data:', error);
  }
  _timesheetCache = {};
  _weeklyCache = {};
  _timesheetLastEmittedJson = null;
  _weeklyLastEmittedJson = null;
  idbDelete(wsKey(STORAGE_KEYS.TIMESHEET_DATA)).catch(err =>
    console.error('IDB delete failed for timesheet data:', err)
  );
  idbDelete(wsKey(STORAGE_KEYS.WEEKLY_TIMESHEET)).catch(err =>
    console.error('IDB delete failed for weekly timesheet:', err)
  );
};

// Save weekly timesheet data to IndexedDB (write-behind cache)
export const saveWeeklyTimesheet = (data) => {
  if (isKeyCorruptPending(STORAGE_KEYS.WEEKLY_TIMESHEET)) {
    console.warn(
      'Refused saveWeeklyTimesheet: corruption pending for ' +
      STORAGE_KEYS.WEEKLY_TIMESHEET + '. Resolve in Settings → Data Recovery.'
    );
    return false;
  }
  _weeklyCache = data === _weeklyCache ? { ...data } : data;
  idbSet(wsKey(STORAGE_KEYS.WEEKLY_TIMESHEET), _weeklyCache).catch(err =>
    console.error('IDB write failed for weekly timesheet:', err)
  );
  const json = JSON.stringify(_weeklyCache);
  if (json !== _weeklyLastEmittedJson) {
    _weeklyLastEmittedJson = json;
    queueMicrotask(() => storageEventSystem.emit(STORAGE_KEYS.WEEKLY_TIMESHEET, {
      key: STORAGE_KEYS.WEEKLY_TIMESHEET, oldValue: null, newValue: null,
    }));
  }
  return true;
};

// Load weekly timesheet data from the in-memory cache (populated by initTimesheetStorage)
export const loadWeeklyTimesheet = () => _weeklyCache ?? {};

// Save week start preference to LocalStorage
export const saveWeekStart = (weekStart) => {
  try {
    localStorage.setItem(wsKey(STORAGE_KEYS.WEEK_START), weekStart);
  } catch (error) {
    console.error('Error saving week start:', error);
  }
};

// Load week start preference from LocalStorage
export const loadWeekStart = () => {
  try {
    return localStorage.getItem(wsKey(STORAGE_KEYS.WEEK_START)) || 'sunday';
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
    localStorage.setItem(wsKey(STORAGE_KEYS.DATE_FORMAT), dateFormat);
  } catch (error) {
    console.error('Error saving date format:', error);
  }
};

export const loadDateFormat = () => {
  try {
    return localStorage.getItem(wsKey(STORAGE_KEYS.DATE_FORMAT)) || 'short';
  } catch (error) {
    console.error('Error loading date format:', error);
    return 'short';
  }
};

// Save clock format preference to LocalStorage
export const saveClockFormat = (clockFormat) => {
  try {
    localStorage.setItem(wsKey(STORAGE_KEYS.CLOCK_FORMAT), clockFormat);
  } catch (error) {
    console.error('Error saving clock format:', error);
  }
};

// Load clock format preference from LocalStorage
export const loadClockFormat = () => {
  try {
    return localStorage.getItem(wsKey(STORAGE_KEYS.CLOCK_FORMAT)) || '12hour'; // Default to 12-hour format
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
    localStorage.setItem(wsKey(STORAGE_KEYS.SORT_ORDER), JSON.stringify(sortOrder));
  } catch (error) {
    console.error('Error saving sort order:', error);
  }
};

// Load sort order preference from LocalStorage
export const loadSortOrder = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.SORT_ORDER));
    return stored !== null ? JSON.parse(stored) : 'desc'; // Default to descending (newest first)
  } catch (error) {
    console.error('Error loading sort order:', error);
    return 'desc'; // Default to descending on error
  }
};

// Save daily hour goal (whole-number hours) to LocalStorage
export const saveDailyHourGoal = (hours) => {
  try {
    localStorage.setItem(wsKey(STORAGE_KEYS.DAILY_HOUR_GOAL), JSON.stringify(hours));
  } catch (error) {
    console.error('Error saving daily hour goal:', error);
  }
};

// Load daily hour goal. Falls back to 8h on missing/corrupt values rather
// than quarantining — a bad number here is harmless and a fresh default is
// the best UX for a settings field.
export const loadDailyHourGoal = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.DAILY_HOUR_GOAL));
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
    localStorage.setItem(wsKey(STORAGE_KEYS.WEEKEND_DAYS), JSON.stringify(cleaned));
  } catch (error) {
    console.error('Error saving weekend days:', error);
  }
};

// Load weekend days. Falls back to [Sun, Sat] on missing/corrupt — a bad
// value here is harmless and the default is the most-common preference.
export const loadWeekendDays = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.WEEKEND_DAYS));
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
    localStorage.setItem(wsKey(STORAGE_KEYS.HEATMAP_COLORS), JSON.stringify(colors));
  } catch (error) {
    console.error('Error saving heatmap colors:', error);
  }
};

export const loadHeatmapColors = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.HEATMAP_COLORS));
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
    localStorage.setItem(wsKey(STORAGE_KEYS.GOAL_RING_COLORS), JSON.stringify(colors));
  } catch (error) {
    console.error('Error saving goal ring colors:', error);
  }
};

export const loadGoalRingColors = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.GOAL_RING_COLORS));
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
    localStorage.setItem(wsKey(STORAGE_KEYS.SHOW_BREAKS), JSON.stringify(showBreaks));
  } catch (error) {
    console.error('Error saving show breaks preference:', error);
  }
};

// Load break visibility preference from LocalStorage
export const loadShowBreaks = () => {
  try {
    const stored = localStorage.getItem(wsKey(STORAGE_KEYS.SHOW_BREAKS));
    return stored !== null ? JSON.parse(stored) : true; // Default to true (show breaks)
  } catch (error) {
    console.error('Error loading show breaks preference:', error);
    return true; // Default to showing breaks on error
  }
};

// Save invoice settings to LocalStorage (only persistent settings, not invoice-specific data)
export const saveInvoiceSettings = (settings) => {
  if (isKeyCorruptPending(wsKey(STORAGE_KEYS.INVOICE_SETTINGS))) {
    console.warn(
      'Refused saveInvoiceSettings: corruption pending for ' +
      wsKey(STORAGE_KEYS.INVOICE_SETTINGS) + '. Resolve in Settings → Data Recovery.'
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
    localStorage.setItem(wsKey(STORAGE_KEYS.INVOICE_SETTINGS), JSON.stringify(persistentSettings));
    return true;
  } catch (error) {
    console.error('Error saving invoice settings:', error);
    return false;
  }
};

// Load invoice settings from LocalStorage
export const loadInvoiceSettings = () => {
  const stored = localStorage.getItem(wsKey(STORAGE_KEYS.INVOICE_SETTINGS));
  let persistentSettings = {};
  if (stored) {
    try {
      persistentSettings = JSON.parse(stored);
    } catch (error) {
      console.error('Error loading invoice settings:', error);
      quarantineCorruption(wsKey(STORAGE_KEYS.INVOICE_SETTINGS), stored);
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
