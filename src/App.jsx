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
  getCorruptionBackups
} from './utils/storage';
import storageEventSystem from './utils/storageEvents';
import { TimezoneProvider, useTimezone } from './contexts/TimezoneContext';
import { UserPreferencesProvider, useUserPreferences } from './contexts/UserPreferencesContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { PomodoroProvider } from './contexts/PomodoroContext';
import './App.css';

function AppContent() {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { changeWeekStart } = useUserPreferences();
  const { warning } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState({});
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker', 'timesheet', or 'data'
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing weekly data
  const [showOnboarding, setShowOnboarding] = useState(false);

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

    // Surface any storage corruption that was quarantined during this session's
    // load functions. The raw blob is preserved under "__kronos_corrupt_*" keys
    // so the user can recover it from devtools rather than discovering silent
    // data loss only when totals look wrong.
    const backups = getCorruptionBackups();
    if (backups.length > 0) {
      warning(
        `Some saved data was unreadable and replaced with defaults. ` +
        `A backup is preserved in localStorage under: ${backups.join(', ')}`,
        15000
      );
    }
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

  return (
    <>
      {showOnboarding ? (
        <Onboarding 
          onComplete={handleOnboardingComplete}
          initialTimezone={selectedTimezone}
        />
      ) : (
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
            <Settings />
          ) : (
            // Data Management View
            <div className="p-6">
              <DataImportExport onImportSuccess={handleImportSuccess} />
            </div>
          )}
        </AppLayout>
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
