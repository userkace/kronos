import React, { useState, useEffect } from 'react';
import TimesheetTable from './components/TimesheetTable';
import DailyTracker from './components/DailyTracker';
import AppLayout from './components/AppLayout';
import DataImportExport from './components/DataImportExport';
import Onboarding from './components/Onboarding';
import Settings from './components/Settings';
import PomodoroTimer from './components/PomodoroTimer';
import {
  saveSelectedWeek,
  loadSelectedWeek,
  saveWeeklyTimesheet,
  loadWeeklyTimesheet,
  saveOnboardingCompleted,
  loadOnboardingCompleted,
  saveWeekStart,
  saveTimezone
} from './utils/storage';
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
  }, []);

  // Refresh weekly timesheet data when trigger changes
  useEffect(() => {
    if (isInitialized) {
      const loadedData = loadWeeklyTimesheet();
      setTimesheetData(loadedData || {});
    }
  }, [refreshTrigger, isInitialized]);

  // Save timesheet data to LocalStorage whenever it changes
  useEffect(() => {
    if (Object.keys(timesheetData).length > 0) {
      saveWeeklyTimesheet(timesheetData);
    }
  }, [timesheetData]);

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
