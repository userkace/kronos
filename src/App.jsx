import React, { useState, useEffect } from 'react';
import TimesheetTable from './components/TimesheetTable';
import DailyTracker from './components/DailyTracker';
import AppLayout from './components/AppLayout';
import DataImportExport from './components/DataImportExport';
import Onboarding from './components/Onboarding';
import Settings from './components/Settings';
import PomodoroTimer from './components/PomodoroTimer';
import InvoicePage from './components/InvoicePage';
import {
  saveSelectedWeek,
  loadSelectedWeek,
  loadWeeklyTimesheet,
  saveOnboardingCompleted,
  loadOnboardingCompleted,
  saveWeekStart,
  saveTimezone,
  getCorruptPendingKeys
} from './utils/storage';
import storageEventSystem from './utils/storageEvents';
import { AlertTriangle } from 'lucide-react';
import { TimezoneProvider, useTimezone } from './contexts/TimezoneContext';
import { UserPreferencesProvider, useUserPreferences } from './contexts/UserPreferencesContext';
import { ToastProvider } from './contexts/ToastContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import './App.css';

function AppContent() {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { changeWeekStart } = useUserPreferences();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState({});
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker', 'timesheet', or 'data'
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing weekly data
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Tracks keys with unresolved corruption. Saves to those keys are refused
  // by the storage layer; the banner here surfaces it persistently and the
  // Data Recovery section in Settings resolves it.
  const [corruptPendingKeys, setCorruptPendingKeys] = useState(() => getCorruptPendingKeys());
  const recheckCorruption = () => setCorruptPendingKeys(getCorruptPendingKeys());

  // Load data from LocalStorage on component mount
  useEffect(() => {
    const loadedDate = loadSelectedWeek();
    const loadedData = loadWeeklyTimesheet();
    const hasCompletedOnboarding = loadOnboardingCompleted();

    console.log('=== App Load Debug ===');
    console.log('Loaded weekly data:', loadedData);
    console.log('Selected timezone:', selectedTimezone);
    console.log('Onboarding completed:', hasCompletedOnboarding);

    setCurrentDate(loadedDate);
    setTimesheetData(loadedData || {});
    setShowOnboarding(!hasCompletedOnboarding);
    setIsInitialized(true);

    // The loadWeeklyTimesheet call above can quarantine new corruption, so
    // re-read the pending list now that all mount loads have run.
    setCorruptPendingKeys(getCorruptPendingKeys());
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
    console.log('=== Onboarding Complete ===');
    console.log('Preferences received:', preferences);
    console.log('Current selectedTimezone before change:', selectedTimezone);
    
    // Save preferences
    changeTimezone(preferences.timezone);
    console.log('Called changeTimezone with:', preferences.timezone);
    changeWeekStart(preferences.weekStart);
    console.log('Called changeWeekStart with:', preferences.weekStart);
    saveOnboardingCompleted();
    
    // Also save timezone directly to ensure it's persisted
    saveTimezone(preferences.timezone);
    
    console.log('Current selectedTimezone after change:', selectedTimezone);
    
    // Hide onboarding
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

  return (
    <>
      {showOnboarding ? (
        <Onboarding
          onComplete={handleOnboardingComplete}
          initialTimezone={selectedTimezone}
        />
      ) : (
        <>
          {corruptionBanner}
          <AppLayout
            currentView={currentView}
            onViewChange={setCurrentView}
          >
            {currentView === 'tracker' ? (
              // Daily Tracker View
              <DailyTracker
                timezone={selectedTimezone}
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
            ) : currentView === 'invoice' ? (
              // Invoice Generator View
              <InvoicePage />
            ) : currentView === 'settings' ? (
              // Settings View
              <Settings onCorruptionResolved={recheckCorruption} />
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
    <ToastProvider>
      <TimezoneProvider>
        <UserPreferencesProvider>
          <PomodoroProvider>
            <AppContent />
          </PomodoroProvider>
        </UserPreferencesProvider>
      </TimezoneProvider>
    </ToastProvider>
  );
}

export default AppWrapper;
