import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TimezoneSelect from './TimezoneSelect';
import AccountSettings from './AccountSettings';
import SidebarItemsSettings from './SidebarItemsSettings';
import DataImportExport from './DataImportExport';
import { useTimezone } from '../contexts/TimezoneContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import {
  clearAllData,
  getCorruptionBackupsDetailed,
  getQuarantineRaw,
  restoreFromQuarantine,
  discardQuarantine,
  DEFAULT_HEATMAP_COLORS,
  DEFAULT_GOAL_RING_COLORS,
} from '../utils/storage';
import {
  Globe, Calendar, Clock, RotateCcw, Trash2, Settings as SettingsIcon,
  AlertTriangle, Download, RefreshCcw, X, BarChart2, Plus, Building2,
  Github, Star, Eye, Sun, Moon, Monitor, Search, SearchX,
} from 'lucide-react';
import { CHANGELOG } from '../data/changelog';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import SettingsNav from './SettingsNav';
import {
  SETTINGS_SECTIONS,
  SETTINGS_CATEGORIES,
  DEFAULT_SETTINGS_CATEGORY,
  matchSettingsSections,
  sectionCategory,
  sectionsInCategory,
} from '../utils/settingsSearch';

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const Settings = ({ onCorruptionResolved, onPreviewOnboarding, onImportSuccess }) => {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { theme, setTheme } = useTheme();
  const {
    weekStart, changeWeekStart,
    clockFormat, changeClockFormat,
    dateFormat, changeDateFormat,
    dailyHourGoal, changeDailyHourGoal,
    weekendDays, changeWeekendDays,
    heatmapColors, changeHeatmapColors,
    goalRingColors, changeGoalRingColors,
  } = useUserPreferences();
  const { success, error, warning, addToast, removeToast } = useToast();
  const [backups, setBackups] = useState(() => getCorruptionBackupsDetailed());

  const refreshBackups = () => {
    setBackups(getCorruptionBackupsDetailed());
    if (onCorruptionResolved) onCorruptionResolved();
  };

  const handleDownloadBackup = (backup) => {
    const raw = getQuarantineRaw(backup.backupKey);
    if (raw == null) {
      error('Backup contents could not be read');
      return;
    }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${backup.backupKey}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Backup downloaded');
  };

  const handleRestoreBackup = (backup) => {
    if (!window.confirm(
      `Restore "${backup.originalKey}" from this backup?\n\n` +
      `The current value (defaulted after the failed load) will be replaced ` +
      `with the quarantined contents. The backup will then be removed.`
    )) return;
    const ok = restoreFromQuarantine(backup.backupKey);
    if (ok) {
      success(`Restored ${backup.originalKey} — reloading…`);
      // A reload is the cleanest way to ensure all in-memory state reflects
      // the freshly-restored value rather than the previously-defaulted one.
      setTimeout(() => window.location.reload(), 800);
    } else {
      error('Restore failed: backup is still unparseable. Try Download to inspect manually.');
    }
  };

  const handleDiscardBackup = (backup) => {
    if (!window.confirm(
      `Discard the backup for "${backup.originalKey}"?\n\n` +
      `The quarantined data will be permanently deleted and the app will ` +
      `continue with empty defaults for this key. This cannot be undone.`
    )) return;
    discardQuarantine(backup.backupKey);
    refreshBackups();
    warning('Backup discarded');
  };

  const [timezone, setTimezone] = useState(selectedTimezone);
  const [weekStartValue, setWeekStartValue] = useState(weekStart);
  const [clockFormatValue, setClockFormatValue] = useState(clockFormat);
  const [dateFormatValue, setDateFormatValue] = useState(dateFormat);
  const [dailyHourGoalValue, setDailyHourGoalValue] = useState(String(dailyHourGoal));
  const [weekendDaysValue, setWeekendDaysValue] = useState(weekendDays);
  const [heatmapColorsEdit, setHeatmapColorsEdit] = useState(() =>
    JSON.parse(JSON.stringify(heatmapColors))
  );
  const [goalRingColorsEdit, setGoalRingColorsEdit] = useState(() => ({ ...goalRingColors }));
  const [isResetting, setIsResetting] = useState(false);
  const reloadTimeoutRef = useRef(null);
  const unsavedToastIdRef = useRef(null);
  const saveCallbackRef = useRef(null);
  const revertCallbackRef = useRef(null);

  // Pull updates from context (e.g. when an outside save changes the goal)
  // so the local input doesn't go stale.
  useEffect(() => {
    setDailyHourGoalValue(String(dailyHourGoal));
  }, [dailyHourGoal]);

  useEffect(() => {
    setWeekendDaysValue(weekendDays);
  }, [weekendDays]);

  const hasUnsaved =
    timezone !== selectedTimezone ||
    weekStartValue !== weekStart ||
    clockFormatValue !== clockFormat ||
    dateFormatValue !== dateFormat ||
    dailyHourGoalValue !== String(dailyHourGoal) ||
    JSON.stringify(weekendDaysValue) !== JSON.stringify(weekendDays);

  const handleRevert = () => {
    setTimezone(selectedTimezone);
    setWeekStartValue(weekStart);
    setClockFormatValue(clockFormat);
    setDateFormatValue(dateFormat);
    setDailyHourGoalValue(String(dailyHourGoal));
    setWeekendDaysValue(weekendDays);
  };

  const toggleWeekendDay = (idx) => {
    setWeekendDaysValue(prev =>
      prev.includes(idx)
        ? prev.filter(d => d !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleTimezoneChange = (newTimezone) => {
    setTimezone(newTimezone);
  };

  const handleWeekStartChange = (newWeekStart) => {
    setWeekStartValue(newWeekStart);
  };

  const handleClockFormatChange = (newClockFormat) => {
    setClockFormatValue(newClockFormat);
  };

  const handleDailyHourGoalChange = (raw) => {
    setDailyHourGoalValue(raw);
  };

  const handleSaveSettings = () => {
    try {
      changeTimezone(timezone);
      changeWeekStart(weekStartValue);
      changeClockFormat(clockFormatValue);
      changeDateFormat(dateFormatValue);
      const parsedGoal = Number(dailyHourGoalValue);
      if (!Number.isFinite(parsedGoal) || parsedGoal <= 0 || parsedGoal > 24) {
        error('Daily hour goal must be between 0 and 24');
        return;
      }
      changeDailyHourGoal(parsedGoal);
      changeWeekendDays(weekendDaysValue);
      success('Settings saved successfully!');
    } catch (err) {
      error('Failed to save settings');
    }
  };

  // Keep refs pointing at the latest callbacks so the toast buttons never
  // close over stale state.
  saveCallbackRef.current = handleSaveSettings;
  revertCallbackRef.current = handleRevert;

  useEffect(() => {
    if (hasUnsaved) {
      if (unsavedToastIdRef.current !== null) return;
      const id = addToast('You have unsaved settings changes', 'warning', 0, null, [
        { label: 'Save', dismissOnClick: true, onClick: () => saveCallbackRef.current() },
        { label: 'Revert', dismissOnClick: true, onClick: () => revertCallbackRef.current() },
      ]);
      unsavedToastIdRef.current = id;
    } else {
      if (unsavedToastIdRef.current === null) return;
      removeToast(unsavedToastIdRef.current);
      unsavedToastIdRef.current = null;
    }
  }, [hasUnsaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetOnboarding = () => {
    if (window.confirm('Are you sure you want to reset onboarding? This will show the setup screen again next time you start the app.')) {
      try {
        // Clear onboarding completion flag
        localStorage.removeItem('kronos_onboarding_completed');
        success('Onboarding reset. The setup screen will appear on next app restart.');
      } catch (err) {
        error('Failed to reset onboarding');
      }
    }
  };

  const handleClearAllData = () => {
    if (window.confirm(
      'Reset everything?\n\n' +
      'This deletes this workspace\'s entries AND every setting and preference — ' +
      'timezone, schedule, colors, sidebar layout, invoice details — then restarts ' +
      'the app. To delete only your tracked time, use Clear Timesheet Data instead.'
    )) {
      if (window.confirm('This action is permanent. Are you absolutely sure?')) {
        try {
          setIsResetting(true);
          clearAllData();
          warning('All data cleared. The app will reload in 3 seconds...');

          // Reload the page after clearing data
          if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
          }
          reloadTimeoutRef.current = setTimeout(() => {
            window.location.reload();
          }, 3000);
        } catch (err) {
          setIsResetting(false);
          error('Failed to clear data');
        }
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      if (unsavedToastIdRef.current !== null) removeToast(unsavedToastIdRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search & categories ───────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(DEFAULT_SETTINGS_CATEGORY);
  const searchInputRef = useRef(null);
  const isSearching = query.trim().length > 0;
  const matchedIds = useMemo(() => matchSettingsSections(query), [query]);

  // Data Recovery only exists when something was quarantined, so it shouldn't
  // count towards "n of m" or keep the empty state away when nothing matches.
  const searchableSections = SETTINGS_SECTIONS.filter(
    s => s.id !== 'recovery' || backups.length > 0
  );
  const matchCount = searchableSections.filter(s => matchedIds.has(s.id)).length;

  // Per-category tallies, so a search can point at the group holding the
  // matches instead of leaving the rail looking inert.
  const categoryMatchCounts = searchableSections.reduce((counts, s) => {
    if (matchedIds.has(s.id)) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, {});

  // Two cards ignore the rail and sit above the groups: Data Recovery, because
  // unresolved corruption is urgent wherever you are, and Save Changes, because
  // it's the only way to commit pending edits and a search must never hide it.
  const isPinnedSection = (id) => id === 'recovery' || id === 'save';

  // Both pinned cards appear in response to something you just did (an edit, a
  // failed load), so they ease in and push the groups down rather than making
  // the page jump. 0.3/easeOut matches the sidebar and the tracker's lists.
  const { getTransition } = useMotionPreferences();
  const pinnedTransition = getTransition({ duration: 0.3, ease: 'easeOut' });
  const pinnedMotion = {
    initial: { opacity: 0, height: 0, y: -8 },
    animate: { opacity: 1, height: 'auto', y: 0 },
    exit: { opacity: 0, height: 0, y: -8 },
    transition: pinnedTransition,
    // The gap below each card lives inside the collapsing wrapper, so it
    // closes up with the card instead of leaving a hole that snaps shut.
    className: 'overflow-hidden',
  };

  const show = (id) => {
    if (id === 'save') return hasUnsaved || (isSearching && matchedIds.has('save'));
    if (!matchedIds.has(id)) return false;
    // A search reaches across every category, exactly as it did before the page
    // was split into groups; otherwise the rail decides what's on screen.
    if (isSearching || isPinnedSection(id)) return true;
    return sectionCategory(id) === activeCategory;
  };

  // Whether a group has anything to show, so its heading doesn't strand itself
  // above an empty stretch of page.
  const groupHasVisible = (categoryId) =>
    sectionsInCategory(categoryId).some(id => !isPinnedSection(id) && show(id));

  const handleCategorySelect = (id) => {
    // Picking a group while searching means "take me there", so the query goes.
    if (isSearching) setQuery('');
    setActiveCategory(id);
  };

  const GroupHeading = ({ categoryId }) => {
    const category = SETTINGS_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return null;
    return (
      <div className="pt-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {category.label}
        </h3>
        <p className="mt-1 text-[13px] text-gray-500">{category.description}</p>
      </div>
    );
  };

  // Divides a group where the cards act on genuinely different things — Data
  // holds both "your entries" and "the whole app", and two cards that both
  // said "Clear All Data" gave no clue which was which.
  const SubHeading = ({ title, description }) => (
    <div className="pt-2">
      <div className="flex items-center gap-3">
        <h4 className="shrink-0 text-sm font-semibold text-gray-700">{title}</h4>
        <span aria-hidden="true" className="h-px flex-1 bg-gray-200/70" />
      </div>
      <p className="mt-1 text-[13px] text-gray-500">{description}</p>
    </div>
  );

  // `/` jumps to the search box, the way it does in most web apps. Ignored
  // while typing so it never eats a literal slash (e.g. a date format).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Escape') return;
    if (query) {
      setQuery('');
    } else {
      searchInputRef.current?.blur();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Preferences</p>
        <h2 className="mt-1.5 font-display text-xl font-semibold text-gray-900">Settings</h2>
        <p className="mt-1.5 text-sm text-gray-500">Tune how Kronos tracks, displays, and organizes your time.</p>
      </div>

      {/* Search — filters the cards below to the ones matching the query.
          Sticky so it stays reachable once you've scrolled deep into the page.
          -mx-6/px-6 bleeds the background across the page gutters so cards
          scroll out of sight behind it. gray-50 to match AppLayout's shell —
          slate-50 is a near-identical light gray but a much darker navy once
          the dark palette remap kicks in, which showed as a band. */}
      <div className="sticky top-0 z-20 -mx-6 mb-5 bg-gray-50/90 px-6 py-4 backdrop-blur-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            role="searchbox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search settings — timezone, dark mode, week start…"
            aria-label="Search settings"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-24 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {isSearching ? (
              <>
                <span className="text-xs tabular-nums text-gray-400">
                  {matchCount}/{searchableSections.length}
                </span>
                <button
                  type="button"
                  onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="grid h-6 w-6 place-items-center rounded-lg text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <kbd className="hidden rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-400 sm:block">
                /
              </kbd>
            )}
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {isSearching ? `${matchCount} of ${searchableSections.length} settings sections match ${query}` : ''}
        </p>
      </div>

      {/* Rail beside the cards on desktop, chips above them on narrow screens.
          Only one group is on screen at a time unless a search is running, which
          is the whole point — the page used to be thirteen cards in one column. */}
      <div className="lg:flex lg:items-start lg:gap-8">
        <SettingsNav
          activeCategory={activeCategory}
          onSelect={handleCategorySelect}
          isSearching={isSearching}
          matchCounts={categoryMatchCounts}
        />

      <div className="min-w-0 flex-1">
        {/* Pinned cards, outside the groups' spacing so their own gap collapses
            with them and the groups below slide up as they go. */}
        <AnimatePresence initial={false}>
          {backups.length > 0 && show('recovery') && (
            <motion.div key="recovery" {...pinnedMotion}>
              <div className="pb-8">
          {/* Data Recovery — only rendered when there are quarantined backups. */}
          <div className="border border-amber-200/80 rounded-2xl p-6 bg-amber-50/80">
            <div className="flex items-center gap-3 mb-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100/80 text-amber-600">
                <AlertTriangle className="w-[18px] h-[18px]" />
              </div>
              <h4 className="text-base font-semibold text-amber-900 tracking-tight">Data Recovery</h4>
            </div>
            <p className="text-sm text-amber-800 mb-4">
              The data below could not be parsed on the last load. Saves to these
              keys are paused until you decide what to do. Choose Restore to
              re-import the backup, Download to inspect it manually, or Discard
              to permanently delete it and start fresh.
            </p>

            <div className="space-y-3">
              {backups.map(backup => (
                <div
                  key={backup.backupKey}
                  className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-gray-900 break-all">
                        {backup.originalKey}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {backup.timestamp
                          ? `Quarantined ${backup.timestamp} UTC · `
                          : ''}
                        {formatBytes(backup.sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleDownloadBackup(backup)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 text-gray-700 rounded-lg shadow-xs transition-colors duration-150"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(backup)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-xs transition-colors duration-150"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDiscardBackup(backup)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-lg shadow-xs transition-colors duration-150"
                    >
                      <X className="w-4 h-4" />
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
              </div>
            </motion.div>
          )}

          {/* Save Changes — pinned so pending edits are always one click from
              being committed, whichever group you're looking at. */}
          {show('save') && (
            <motion.div key="save" {...pinnedMotion}>
              <div className="pb-8">
          <div className="border border-blue-200/80 rounded-2xl p-5 bg-blue-50/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-100/80 text-blue-600">
                  <SettingsIcon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 tracking-tight">Save Changes</h4>
                  <p className="text-[13px] text-blue-700">Apply your updated settings</p>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 hover:bg-blue-500 active:bg-blue-700 transition-colors duration-150 flex items-center gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <div className="space-y-8">
        {/* No matches — offer the way back rather than a bare dead end. */}
        {isSearching && matchCount === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gray-100 text-gray-400">
              <SearchX className="h-5 w-5" />
            </div>
            <p className="mt-3.5 text-sm font-semibold text-gray-900">No settings match “{query.trim()}”</p>
            <p className="mt-1 text-[13px] text-gray-500">
              Try a shorter phrase, or browse everything from the top.
            </p>
            <button
              type="button"
              onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-xs transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
              Clear search
            </button>
          </div>
        )}

        {/* ── General ─────────────────────────────────────────────────────── */}
        {groupHasVisible('general') && (
        <section className="space-y-5">
        <GroupHeading categoryId="general" />

        {/* Timezone Settings */}
        {show('timezone') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Globe className="w-[18px] h-[18px]" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 tracking-tight">Timezone Settings</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                Your Timezone
              </label>
              <TimezoneSelect
                timezone={timezone}
                onTimezoneChange={handleTimezoneChange}
              />
              <div className="mt-3 flex gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                <Building2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Working remotely?</span> If your company is in a different timezone, you can set this to their location so your tracked hours align with their business hours instead of your local time.
                </p>
              </div>
            </div>
          </div>
        </div>

        )}

        {/* Clock Format Settings */}
        {show('clock') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="w-[18px] h-[18px]" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 tracking-tight">Clock Format</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="clockFormat" className="block text-sm font-medium text-gray-700 mb-2">
                Clock Display Format
              </label>
              <select
                id="clockFormat"
                value={clockFormatValue}
                onChange={(e) => handleClockFormatChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="12hour">12-hour (AM/PM)</option>
                <option value="24hour">24-hour</option>
              </select>
            </div>

            <div>
              <label htmlFor="dateFormat" className="block text-sm font-medium text-gray-700 mb-2">
                Date Display Format
              </label>
              <select
                id="dateFormat"
                value={dateFormatValue}
                onChange={(e) => setDateFormatValue(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="short">May 13, 2026</option>
                <option value="long">Tuesday, May 13, 2026</option>
                <option value="short-no-year">May 13</option>
                <option value="weekday">Tue, May 13</option>
                <option value="weekday-year">Tue, May 13, 2026</option>
                <option value="numeric">5/13/2026</option>
                <option value="dmy">13/05/2026</option>
                <option value="iso">2026-05-13</option>
                <option value="none">Time only</option>
              </select>
              <p className="mt-1.5 text-[13px] text-gray-500">
                Choose how the date is shown alongside the clock in the navigation bar
              </p>
            </div>
          </div>
        </div>

        )}

        {/* Work Schedule — week start, non-work days, and daily hour goal */}
        {show('schedule') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Calendar className="w-[18px] h-[18px]" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 tracking-tight">Work Schedule</h4>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="weekStart" className="block text-sm font-medium text-gray-700 mb-2">
                Start of the Week
              </label>
              <select
                id="weekStart"
                value={weekStartValue}
                onChange={(e) => handleWeekStartChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
              <p className="mt-1.5 text-[13px] text-gray-500">
                Choose which day your week starts on.
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Non-Work Days
              </label>
              <div className="flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, idx) => {
                  const isSelected = weekendDaysValue.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleWeekendDay(idx)}
                      aria-pressed={isSelected}
                      className={`min-w-13 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                          : 'border-gray-200 bg-white text-gray-600 shadow-xs hover:border-gray-300 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-gray-500">
                Days you don't normally work. Skipping these won't break your streak on the Reports view.
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label htmlFor="dailyHourGoal" className="block text-sm font-medium text-gray-700 mb-2">
                Daily Hours Goal
              </label>
              <input
                id="dailyHourGoal"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={dailyHourGoalValue}
                onChange={(e) => handleDailyHourGoalChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1.5 text-[13px] text-gray-500">
                Target tracked hours per day. Drives the goal ring on the Reports view.
              </p>
            </div>
          </div>
        </div>

        )}
        </section>
        )}

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        {groupHasVisible('appearance') && (
        <section className="space-y-5">
        <GroupHeading categoryId="appearance" />

        {/* Appearance */}
        {show('appearance') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Moon className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-gray-900 tracking-tight">Theme</h4>
              <p className="text-[13px] text-gray-500">How Kronos looks on this device.</p>
            </div>
          </div>
          <div className="grid max-w-sm grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => {
              const isSelected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors duration-150 ${
                    isSelected
                      ? 'bg-white text-gray-900 shadow-xs ring-1 ring-gray-200/70'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        )}

        {/* Sidebar Items — device-local, like the theme above it. */}
        {show('sidebar') && <SidebarItemsSettings />}

        {/* Heatmap Colors */}
        {show('heatmap') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <BarChart2 className="w-[18px] h-[18px]" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 tracking-tight">Heatmap Colors</h4>
          </div>

          <div className="space-y-4">
            {/* Live preview */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span>Less</span>
              <div className="w-4 h-4 rounded-sm border border-gray-200" style={{ backgroundColor: heatmapColorsEdit.emptyColor }} />
              {[...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo).map((stop, i) => (
                <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: stop.color }} />
              ))}
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: heatmapColorsEdit.completionColor }} />
              <span>Goal met</span>
            </div>

            {/* Color stops */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Progress Stops</p>
              <div className="space-y-2">
                {(() => {
                  const sorted = [...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo);
                  return sorted.map((stop, i) => {
                    const prevUpTo = i === 0 ? 0 : sorted[i - 1].upTo;
                    const nextUpTo = i < sorted.length - 1 ? sorted[i + 1].upTo : 101;
                    const isLast = i === sorted.length - 1;

                    const updateStop = (patch) => {
                      const newStops = sorted.map((s, j) => j === i ? { ...s, ...patch } : s);
                      const updated = { ...heatmapColorsEdit, stops: newStops };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    };

                    const removeStop = () => {
                      const newStops = sorted.filter((_, j) => j !== i);
                      const updated = { ...heatmapColorsEdit, stops: newStops };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    };

                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stop.color}
                          onChange={(e) => updateStop({ color: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 shadow-xs p-0.5 shrink-0"
                          title="Pick color"
                        />
                        <span className="text-xs text-gray-400 w-7 text-right shrink-0">{prevUpTo}%</span>
                        <span className="text-xs text-gray-300 shrink-0">–</span>
                        {isLast ? (
                          <span className="text-xs text-gray-500">100% <span className="text-gray-400">(below goal)</span></span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={prevUpTo + 1}
                              max={nextUpTo - 1}
                              value={stop.upTo}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (Number.isInteger(v) && v > prevUpTo && v < nextUpTo) {
                                  updateStop({ upTo: v });
                                }
                              }}
                              className="w-14 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        )}
                        {!isLast && (
                          <button
                            onClick={removeStop}
                            className="ml-auto p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors duration-150"
                            title="Remove stop"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <button
                onClick={() => {
                  const sorted = [...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo);
                  const last = sorted[sorted.length - 1];
                  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : { upTo: 0 };
                  const newUpTo = Math.floor((prev.upTo + 100) / 2);
                  const newStop = { upTo: newUpTo, color: last.color };
                  const newStops = [...sorted.slice(0, -1), newStop, last];
                  const updated = { ...heatmapColorsEdit, stops: newStops };
                  setHeatmapColorsEdit(updated);
                  changeHeatmapColors(updated);
                }}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
              >
                <Plus className="w-3.5 h-3.5" />
                Add stop
              </button>
            </div>

            {/* Completion & empty colors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Goal met (≥ 100%)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heatmapColorsEdit.completionColor}
                    onChange={(e) => {
                      const updated = { ...heatmapColorsEdit, completionColor: e.target.value };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 shadow-xs p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{heatmapColorsEdit.completionColor}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">No time tracked</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heatmapColorsEdit.emptyColor}
                    onChange={(e) => {
                      const updated = { ...heatmapColorsEdit, emptyColor: e.target.value };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 shadow-xs p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{heatmapColorsEdit.emptyColor}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">Changes apply immediately to the Reports view.</p>
              <button
                onClick={() => {
                  const defaults = JSON.parse(JSON.stringify(DEFAULT_HEATMAP_COLORS));
                  setHeatmapColorsEdit(defaults);
                  changeHeatmapColors(defaults);
                }}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to default
              </button>
            </div>
          </div>
        </div>

        )}

        {/* Goal Ring Colors */}
        {show('goalring') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <BarChart2 className="w-[18px] h-[18px]" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 tracking-tight">Goal Ring Colors</h4>
          </div>

          <div className="space-y-4">
            {/* Live preview */}
            <div className="flex items-center gap-3">
              <svg width="48" height="48" className="-rotate-90">
                <circle cx="24" cy="24" r="18" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={goalRingColorsEdit.progressColor} strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 18} strokeDashoffset={2 * Math.PI * 18 * 0.35} />
              </svg>
              <svg width="48" height="48" className="-rotate-90">
                <circle cx="24" cy="24" r="18" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={goalRingColorsEdit.completionColor} strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 18} strokeDashoffset={0} />
              </svg>
              <span className="text-xs text-gray-400">In progress · Complete</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">In progress</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={goalRingColorsEdit.progressColor}
                    onChange={(e) => {
                      const updated = { ...goalRingColorsEdit, progressColor: e.target.value };
                      setGoalRingColorsEdit(updated);
                      changeGoalRingColors(updated);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 shadow-xs p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{goalRingColorsEdit.progressColor}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Goal met (≥ 100%)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={goalRingColorsEdit.completionColor}
                    onChange={(e) => {
                      const updated = { ...goalRingColorsEdit, completionColor: e.target.value };
                      setGoalRingColorsEdit(updated);
                      changeGoalRingColors(updated);
                    }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 shadow-xs p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{goalRingColorsEdit.completionColor}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  const updated = {
                    progressColor: heatmapColorsEdit.stops[heatmapColorsEdit.stops.length - 1]?.color ?? heatmapColorsEdit.completionColor,
                    completionColor: heatmapColorsEdit.completionColor,
                  };
                  setGoalRingColorsEdit(updated);
                  changeGoalRingColors(updated);
                }}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
              >
                <RotateCcw className="w-3 h-3" />
                Copy from heatmap
              </button>
              <button
                onClick={() => {
                  const defaults = { ...DEFAULT_GOAL_RING_COLORS };
                  setGoalRingColorsEdit(defaults);
                  changeGoalRingColors(defaults);
                }}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to default
              </button>
            </div>
          </div>
        </div>

        )}
        </section>
        )}

        {/* ── Account ─────────────────────────────────────────────────────── */}
        {groupHasVisible('account') && (
        <section className="space-y-5">
        <GroupHeading categoryId="account" />

        {/* Account & Sync — optional cloud accounts and cross-device sync. */}
        {show('account') && <AccountSettings />}
        </section>
        )}

        {/* ── Data ────────────────────────────────────────────────────────── */}
        {groupHasVisible('data') && (
        <section className="space-y-5">
        <GroupHeading categoryId="data" />

        {/* Your entries — everything here acts on tracked time only and leaves
            settings alone, including its Clear Timesheet Data card. */}
        {show('data-management') && (
          <SubHeading
            title="Tracker & timesheet data"
            description="Your time entries and weekly summaries. Settings and preferences aren't touched by anything here."
          />
        )}

        {/* Import/Export — the whole of the old Data Management view, moved in
            here unchanged; `embedded` just drops its page heading. */}
        {show('data-management') && (
          <DataImportExport embedded onImportSuccess={onImportSuccess} />
        )}

        {/* The whole app — these two reach past your entries into preferences
            and the app's own state, which is why they're kept apart. */}
        {(show('reset-onboarding') || show('clear-data')) && (
          <SubHeading
            title="App-wide"
            description="Preferences, setup, and Kronos itself — not just your tracked time."
          />
        )}

        {/* Reset Options — the wrapper only exists for the inner spacing, so it
            goes away too when a search hides both cards. */}
        {(show('reset-onboarding') || show('clear-data')) && (
          <div className="space-y-4">
            {show('reset-onboarding') && (
            <div className="flex items-center justify-between p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100/80 text-amber-600">
                  <RotateCcw className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-amber-900">Reset Onboarding</h5>
                  <p className="text-[13px] text-amber-700">Show the setup screen again on next app start</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Dev-host-only (see VITE_DEV_HOST): walk through onboarding
                    without saving anything. */}
                {onPreviewOnboarding && (
                  <button
                    type="button"
                    onClick={onPreviewOnboarding}
                    className="px-4 py-2.5 bg-white border border-dashed border-amber-300 text-amber-700 text-sm font-semibold rounded-xl shadow-xs hover:bg-amber-50 transition-colors duration-150 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                )}
                <button
                  onClick={handleResetOnboarding}
                  className="px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-amber-600/25 hover:bg-amber-500 active:bg-amber-700 transition-colors duration-150 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
            )}

            {show('clear-data') && (
            <div className="flex items-center justify-between p-5 bg-red-50/80 border border-red-200/80 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100/80 text-red-600">
                  <Trash2 className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-red-900">Reset Everything</h5>
                  <p className="text-[13px] text-red-700">
                    Delete this workspace's entries <span className="font-semibold">and</span> every setting and
                    preference
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearAllData}
                disabled={isResetting}
                className="px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-red-600/25 hover:bg-red-500 active:bg-red-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Resetting...' : 'Reset All'}</span>
              </button>
            </div>
            )}
          </div>
        )}
        </section>
        )}

        {/* ── About ───────────────────────────────────────────────────────── */}
        {groupHasVisible('about') && (
        <section className="space-y-5">
        <GroupHeading categoryId="about" />

        {/* About */}
        {show('about') && (
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600">
                <Github className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900 tracking-tight">
                  kronos{' '}
                  <span className="text-sm font-normal text-gray-400 tabular-nums">
                    v{CHANGELOG[0].version}
                  </span>
                </h4>
                <p className="text-[13px] text-gray-500">
                  Open source, made by{' '}
                  <a
                    href="https://github.com/userkace"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-600 hover:text-gray-900 underline decoration-gray-300 underline-offset-2 transition-colors duration-150"
                  >
                    @userkace
                  </a>
                </p>
              </div>
            </div>
            <a
              href="https://github.com/userkace/kronos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 text-gray-700 rounded-lg shadow-xs transition-colors duration-150"
            >
              <Star className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>
        </div>
        )}
        </section>
        )}

      </div>
      </div>
      </div>
    </div>
    </div>
  );
};

export default Settings;
