import React, { useState, useEffect } from 'react';
import WeekNavigator from './components/WeekNavigator';
import TimesheetTable from './components/TimesheetTable';
import DailyTracker from './components/DailyTracker';
import AppLayout from './components/AppLayout';
import { 
  saveSelectedWeek, 
  loadSelectedWeek,
  saveWeeklyTimesheet,
  loadWeeklyTimesheet
} from './utils/storage';
import { TimezoneProvider, useTimezone } from './contexts/TimezoneContext';
import './App.css';

function AppContent() {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timesheetData, setTimesheetData] = useState({});
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' or 'timesheet'
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing weekly data

  // Load data from LocalStorage on component mount
  useEffect(() => {
    const loadedDate = loadSelectedWeek();
    const loadedData = loadWeeklyTimesheet();
    
    setCurrentDate(loadedDate);
    setTimesheetData(loadedData || {});
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

  const handleTimesheetChange = (newData) => {
    setTimesheetData(newData);
  };

  return (
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
      ) : (
        // Weekly Timesheet View
        <div className="p-6">
          <WeekNavigator 
            currentDate={currentDate} 
            onWeekChange={handleWeekChange} 
            timezone={selectedTimezone} 
          />
          <div className="mt-6">
            <TimesheetTable 
              currentDate={currentDate} 
              timesheetData={timesheetData} 
              onTimesheetChange={handleTimesheetChange} 
              timezone={selectedTimezone} 
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function AppWrapper() {
  return (
    <TimezoneProvider>
      <AppContent />
    </TimezoneProvider>
  );
}

export default AppWrapper;
