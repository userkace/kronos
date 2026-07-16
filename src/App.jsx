import React, { useState, useEffect } from 'react';
import TimesheetTable from './components/TimesheetTable';
import DailyTracker from './components/DailyTracker';
import AppLayout from './components/AppLayout';
import DataImportExport from './components/DataImportExport';
import Onboarding from './components/Onboarding';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence } from 'framer-motion';
import Settings from './components/Settings';
import PomodoroTimer from './components/PomodoroTimer';
import InvoicePage from './components/InvoicePage';
import Reports from './components/Reports';
import {
  saveSelectedWeek,
  loadSelectedWeek,
  loadWeeklyTimesheet,
  saveOnboardingCompleted,
  loadOnboardingCompleted,
  saveWeekStart,
  saveTimezone,
  getCorruptPendingKeys,
  loadChangelogLastSeenVersion,
  saveChangelogLastSeenVersion,
  initTimesheetStorage,
} from './utils/storage';
import storageEventSystem from './utils/storageEvents';
import { AlertTriangle } from 'lucide-react';
import ChangelogModal from './components/ChangelogModal';
import { getLatestChangelogVersion, getChangesSince, CHANGELOG } from './data/changelog';
import { TimezoneProvider, useTimezone } from './contexts/TimezoneContext';
import { UserPreferencesProvider, useUserPreferences } from './contexts/UserPreferencesContext';
import { ToastProvider } from './contexts/ToastContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SyncConflictModal from './components/SyncConflictModal';
import './App.css';

// Dev-only helpers (e.g. previewing onboarding from Settings) are enabled only
// when the page is served from the exact host named in VITE_DEV_HOST
// (.env.local, not committed) — e.g. localhost:5173.
const IS_DEV_HOST =
  Boolean(import.meta.env.VITE_DEV_HOST) &&
  window.location.host === import.meta.env.VITE_DEV_HOST;

function AppContent() {
  const { selectedTimezone, changeTimezone, isInitialized: timezoneInitialized } = useTimezone();
  const { changeWeekStart, changeWeekendDays } = useUserPreferences();
  const { conflicts, resolveConflicts } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState({});
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker', 'timesheet', or 'data'
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing weekly data
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Dev-host-only walkthrough of the onboarding flow. Purely visual: completing
  // (or exiting) it saves nothing — no timezone, week start, or onboarding flag.
  const [previewingOnboarding, setPreviewingOnboarding] = useState(false);
  // Branded splash overlay. Shown on load for users who've already onboarded,
  // and again right after the onboarding flow completes. Self-dismisses.
  const [showSplash, setShowSplash] = useState(false);

  // Tracks keys with unresolved corruption. Saves to those keys are refused
  // by the storage layer; the banner here surfaces it persistently and the
  // Data Recovery section in Settings resolves it.
  const [corruptPendingKeys, setCorruptPendingKeys] = useState(() => getCorruptPendingKeys());
  const recheckCorruption = () => setCorruptPendingKeys(getCorruptPendingKeys());

  // "What's new" modal state. Populated on mount with the entries the user
  // hasn't seen yet; null/empty means nothing to show.
  const [changelogEntries, setChangelogEntries] = useState([]);
  // Whether there are entries the user hasn't acknowledged. Drives the dot on
  // the header bell icon and is independent of whether the modal is open.
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);

  const dismissChangelog = () => {
    saveChangelogLastSeenVersion(getLatestChangelogVersion());
    setChangelogEntries([]);
    setHasUnseenChangelog(false);
  };

  // Manual open from the header bell — shows the full changelog so the user
  // can browse history, not just the unseen subset.
  const openChangelog = () => {
    setChangelogEntries(CHANGELOG);
  };

  // Load data on component mount — wait for IDB cache to be ready first
  useEffect(() => {
    const init = async () => {
      await initTimesheetStorage();

      const loadedDate = loadSelectedWeek();
      const loadedData = loadWeeklyTimesheet();
      const hasCompletedOnboarding = loadOnboardingCompleted();

      setCurrentDate(loadedDate);
      setTimesheetData(loadedData || {});
      setShowOnboarding(!hasCompletedOnboarding);
      // Returning users get the splash on load; fresh installs see onboarding
      // first and get the splash when they finish it.
      setShowSplash(Boolean(hasCompletedOnboarding));
      setIsInitialized(true);

      // Re-read the pending list now that all mount loads have run.
      setCorruptPendingKeys(getCorruptPendingKeys());

      // Decide whether to surface "What's new". Versions are now arbitrary
      // strings; comparison is plain equality, so any mismatch with the
      // current `latestVersion` counts as "there's something new".
      //
      //   - Fresh install (lastSeen == null && !onboarded): onboarding handles
      //     the welcome experience. Seed silently to the latest version so the
      //     modal doesn't pop on top of the onboarding flow.
      //   - Existing user, pre-changelog upgrade (lastSeen == null && onboarded):
      //     they've been using the app but never had the changelog feature —
      //     getChangesSince(null) returns the full log.
      //   - Existing user, new release (lastSeen !== latestVersion && onboarded):
      //     show only entries newer than what they've seen. If the stored value
      //     is unrecognized (e.g. a legacy numeric '2'), getChangesSince also
      //     returns the full log.
      //   - Onboarding incomplete for any other reason: suppress until the
      //     next reload after onboarding completes.
      //
      // The JSX render also gates on !showOnboarding as defense-in-depth.
      const lastSeen = loadChangelogLastSeenVersion();
      const latestVersion = getLatestChangelogVersion();
      if (lastSeen == null && !hasCompletedOnboarding) {
        saveChangelogLastSeenVersion(latestVersion);
      } else if (hasCompletedOnboarding && latestVersion != null && lastSeen !== latestVersion) {
        setChangelogEntries(getChangesSince(lastSeen));
        setHasUnseenChangelog(true);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh weekly timesheet data when trigger changes
  useEffect(() => {
    if (isInitialized) {
      const loadedData = loadWeeklyTimesheet();
      setTimesheetData(loadedData || {});
    }
  }, [refreshTrigger, isInitialized]);

  // Pick up weekly timesheet writes that don't go through the
  // onWeeklyTimesheetSave callback (e.g. Pomodoro session auto-save).
  useEffect(() => {
    if (!isInitialized) return;
    const unsubscribe = storageEventSystem.subscribe('kronos_weekly_timesheet', () => {
      const loadedData = loadWeeklyTimesheet();
      setTimesheetData(loadedData || {});
    });
    return unsubscribe;
  }, [isInitialized]);

  // No save-on-state-change effect: weekly data is written directly through
  // saveWeeklyTimesheet (in writeWeeklyTimesheetForDates and DailyTracker
  // edit handlers). App.jsx state is a read-only mirror of storage, kept in
  // sync via the storage event subscription above. A save-on-change effect
  // here would clobber storage with an empty object on any load failure.

  // Save selected week to LocalStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      saveSelectedWeek(currentDate);
    }
  }, [currentDate, isInitialized]);

  // Always open the Timesheet on the current week, mirroring how the Daily
  // Tracker always opens on today. Within the view the user can still navigate
  // to other weeks, but switching away and back resets to the current week.
  useEffect(() => {
    if (isInitialized && currentView === 'timesheet') {
      setCurrentDate(new Date());
    }
  }, [currentView, isInitialized]);

  const handleWeekChange = (newDate) => {
    setCurrentDate(newDate);
  };

  const handleImportSuccess = () => {
    // Refresh all data after import
    const loadedDate = loadSelectedWeek();
    const loadedData = loadWeeklyTimesheet();

    setCurrentDate(loadedDate);
    setTimesheetData(loadedData || {});
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOnboardingComplete = (preferences) => {
    changeTimezone(preferences.timezone);
    changeWeekStart(preferences.weekStart);
    if (Array.isArray(preferences.weekendDays)) {
      changeWeekendDays(preferences.weekendDays);
    }
    saveOnboardingCompleted();
    // Also save timezone directly to ensure it's persisted before the next render.
    saveTimezone(preferences.timezone);
    setShowSplash(true);
    setShowOnboarding(false);
  };

  const corruptionBanner = corruptPendingKeys.length > 0 ? (
    <button
      type="button"
      onClick={() => setCurrentView('settings')}
      className="sticky top-0 z-40 w-full flex items-center gap-3 px-4 py-3 bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors text-left"
    >
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span className="flex-1">
        {corruptPendingKeys.length === 1
          ? `Corrupt data detected on load. Saves to "${corruptPendingKeys[0]}" are paused until you resolve it.`
          : `Corrupt data detected on load. Saves to ${corruptPendingKeys.length} storage keys are paused until you resolve them.`}
      </span>
      <span className="underline whitespace-nowrap">Open Data Recovery →</span>
    </button>
  ) : null;

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3.5 text-gray-400">
          <svg className="animate-spin w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Cloud-sync conflict resolver — overlays everything when sign-in finds
          documents changed both locally and in the account. */}
      {conflicts.length > 0 && (
        <SyncConflictModal conflicts={conflicts} onResolve={resolveConflicts} />
      )}
      {/* Splash overlays the app (z-100) while it mounts underneath, then
          fades out via the AnimatePresence exit animation. */}
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      </AnimatePresence>
      {showOnboarding || previewingOnboarding ? (
        <>
          <Onboarding
            onComplete={previewingOnboarding
              ? () => setPreviewingOnboarding(false)
              : handleOnboardingComplete}
            initialTimezone={selectedTimezone}
          />
          {previewingOnboarding && (
            <button
              type="button"
              onClick={() => setPreviewingOnboarding(false)}
              className="fixed top-4 right-4 z-120 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900/80 hover:bg-gray-900 text-white rounded-full shadow-lg backdrop-blur-sm transition-colors"
            >
              Exit preview
            </button>
          )}
        </>
      ) : (
        <>
          {corruptionBanner}
          {/* Render guard: this branch only runs when !showOnboarding, so the
              modal cannot appear while the onboarding flow is active. The
              entries.length check keeps it suppressed when there's nothing
              new to show. */}
          <AnimatePresence>
            {changelogEntries.length > 0 && (
              <ChangelogModal
                entries={changelogEntries}
                onDismiss={dismissChangelog}
              />
            )}
          </AnimatePresence>
          <AppLayout
            currentView={currentView}
            onViewChange={setCurrentView}
            onShowChangelog={openChangelog}
            hasUnseenChangelog={hasUnseenChangelog}
          >
            {currentView === 'tracker' ? (
              // Daily Tracker View
              <DailyTracker
                timezone={selectedTimezone}
                timezoneInitialized={timezoneInitialized}
                onTimezoneChange={changeTimezone}
                onWeeklyTimesheetSave={() => setRefreshTrigger(prev => prev + 1)}
              />
            ) : currentView === 'pomodoro' ? (
              // Pomodoro Timer View
              <PomodoroTimer />
            ) : currentView === 'timesheet' ? (
              // Weekly Timesheet View
              <div className="p-6 max-w-7xl mx-auto">
                <TimesheetTable
                  currentDate={currentDate}
                  timesheetData={timesheetData}
                  timezone={selectedTimezone}
                  onWeekChange={handleWeekChange}
                />
              </div>
            ) : currentView === 'reports' ? (
              <Reports />
            ) : currentView === 'invoice' ? (
              // Invoice Generator View
              <InvoicePage />
            ) : currentView === 'settings' ? (
              // Settings View
              <Settings
                onCorruptionResolved={recheckCorruption}
                onPreviewOnboarding={IS_DEV_HOST ? () => setPreviewingOnboarding(true) : undefined}
              />
            ) : (
              // Data Management View
              <div className="p-6">
                <DataImportExport onImportSuccess={handleImportSuccess} />
              </div>
            )}
          </AppLayout>
        </>
      )}
    </>
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <TimezoneProvider>
              <UserPreferencesProvider>
                <PomodoroProvider>
                  <AppContent />
                </PomodoroProvider>
              </UserPreferencesProvider>
            </TimezoneProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default AppWrapper;
