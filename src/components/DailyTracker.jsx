import React, { useState, useEffect } from 'react';
import { format, differenceInSeconds, differenceInMinutes, parseISO, parse, addDays, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Play, Pause, Plus, Clock, Edit, ChevronLeft, ChevronRight, Merge } from 'lucide-react';
import TimezoneSelect from './TimezoneSelect';
import TimeEntryModal from './TimeEntryModal';
import { useToast } from '../contexts/ToastContext';
import {
  saveTimesheetData,
  loadTimesheetData,
  saveTimezone,
  loadTimezone,
  saveSelectedWeek,
  loadSelectedWeek,
  saveWeeklyTimesheet,
  loadWeeklyTimesheet
} from '../utils/storage';

const DailyTracker = ({ timezone, onTimezoneChange, onWeeklyTimesheetSave = () => {} }) => {
  const { success, error, warning } = useToast();
  const [currentTask, setCurrentTask] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // Initialize to today in UTC
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    initialData: null
  });

  // Helper function to format date in selected timezone
  const formatInTimezone = (date, formatStr) => {
    // Use toLocaleString for reliable timezone conversion
    const dateInTimezone = new Date(date.toLocaleString("en-US", {timeZone: timezone}));
    return format(dateInTimezone, formatStr);
  };

  // Helper function to get storage date key for a specific date
  const getStorageDateKey = (date) => {
    // If a date is provided, use it directly, otherwise use current date
    if (typeof date === 'string') {
      return date; // Already in yyyy-MM-dd format
    }
    if (date) {
      // Use the provided date in the selected timezone for storage key
      // Use toLocaleString for reliable timezone conversion
      const dateInTimezone = new Date(date.toLocaleString("en-US", {timeZone: timezone}));
      return format(dateInTimezone, 'yyyy-MM-dd');
    }
    // If no date provided, use current date in selected timezone
    const nowInTimezone = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
    return format(nowInTimezone, 'yyyy-MM-dd');
  };

  // Helper function to get current date in selected timezone
  const getCurrentDateInTimezone = () => {
    // Get the current time in the selected timezone
    const now = new Date();
    return toZonedTime(now, timezone);
  };

  // Update selectedDate to today when timezone changes
  useEffect(() => {
    // Keep the date as UTC, only format for display
    setSelectedDate(new Date());
  }, [timezone]);

  // Load data from localStorage on mount and when date changes
  useEffect(() => {
    const loadedData = loadTimesheetData();
    const storageKey = getStorageDateKey(selectedDate);
    const displayDate = formatInTimezone(selectedDate, 'yyyy-MM-dd');

    if (loadedData && loadedData[storageKey]) {
      const dayEntries = loadedData[storageKey] || [];
      // Sort entries by start time (earliest first)
      const sortedEntries = dayEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setTodayEntries(sortedEntries);

      // Check for active entry (only for current date in selected timezone)
      const todayInSelectedTimezone = formatInTimezone(new Date(), 'yyyy-MM-dd');
      const isCurrentDate = todayInSelectedTimezone === displayDate;
      if (isCurrentDate) {
        const active = dayEntries.find(entry => entry.isActive);
        if (active) {
          setActiveEntry(active);
        }
      } else {
        setActiveEntry(null); // No active entries for other dates
      }
    } else {
      setTodayEntries([]);
      setActiveEntry(null);
    }
  }, [timezone, selectedDate]); // Re-load when timezone or selected date changes

  // Date navigation functions
  const handlePreviousDay = () => {
    setSelectedDate(prevDate => subDays(prevDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prevDate => addDays(prevDate, 1));
  };

  const handleToday = () => {
    // Set to today's date in UTC (only format for display)
    setSelectedDate(new Date());
  };

  // Check if selected date is today (in selected timezone)
  const isToday = () => {
    const todayInSelectedTimezone = formatInTimezone(new Date(), 'yyyy-MM-dd');
    const selectedDateInTimezone = formatInTimezone(selectedDate, 'yyyy-MM-dd');
    return todayInSelectedTimezone === selectedDateInTimezone;
  };

  // Update current time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentDateInTimezone());
    }, 1000);

    return () => clearInterval(timer);
  }, [timezone]); // Re-create timer when timezone changes

  // Save entries to localStorage whenever they change (for timer entries only)
  useEffect(() => {
    // Only save if we have timer entries (active or recently completed)
    const hasTimerEntries = todayEntries.some(entry =>
      entry.isActive || (entry.startTime && !entry.date) // Timer entries don't have a date field
    );

    if (hasTimerEntries) {
      const storageKey = getStorageDateKey(); // Use current date in selected timezone
      const displayDate = formatInTimezone(getCurrentDateInTimezone(), 'yyyy-MM-dd');
      const allData = loadTimesheetData() || {};
      allData[storageKey] = todayEntries;

      saveTimesheetData(allData);
    }
  }, [todayEntries, timezone]); // Re-save when timezone changes

  // Calculate duration for active entry
  const getActiveDuration = (entry) => {
    if (!entry) return '0:00:00';

    // Convert both times to the selected timezone for accurate calculation
    const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
    const currentTimeInTimezone = currentTime; // currentTime is already in timezone

    const seconds = differenceInSeconds(currentTimeInTimezone, startTimeInTimezone);
    return formatDuration(seconds);
  };

  // Format duration in HH:MM:SS
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration for display (h min format)
  const formatDisplayDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  // Calculate break time between two consecutive entries
  const calculateBreakTime = (currentEntry, previousEntry) => {
    if (!previousEntry || !previousEntry.endTime || !currentEntry.startTime) return null;

    const prevEndInTimezone = toZonedTime(parseISO(previousEntry.endTime), timezone);
    const currentStartInTimezone = toZonedTime(parseISO(currentEntry.startTime), timezone);

    const breakSeconds = differenceInSeconds(currentStartInTimezone, prevEndInTimezone);

    // Only show breaks longer than 1 minute
    if (breakSeconds <= 60) return null;

    return breakSeconds;
  };

  // Calculate total daily time
  const calculateDailyTotal = () => {
    let totalSeconds = 0;

    // Add completed entries
    todayEntries.forEach(entry => {
      if (!entry.isActive && entry.endTime) {
        // Convert both times to the selected timezone for accurate calculation
        const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
        const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
        totalSeconds += differenceInSeconds(endTimeInTimezone, startTimeInTimezone);
      }
    });

    // Add active entry time
    if (activeEntry) {
      const startTimeInTimezone = toZonedTime(parseISO(activeEntry.startTime), timezone);
      const currentTimeInTimezone = currentTime; // currentTime is already in timezone
      totalSeconds += differenceInSeconds(currentTimeInTimezone, startTimeInTimezone);
    }

    return formatDisplayDuration(totalSeconds);
  };

  // Start new timer (only works on current date)
  const handleStart = () => {
    if (!currentTask.trim()) return;
    if (!isToday()) {
      warning('You can only start timers for the current day');
      return;
    }

    // Stop any active entry first
    if (activeEntry) {
      handleStop();
    }

    // Get current time in selected timezone and convert to UTC for storage
    const now = new Date(); // Current UTC time
    const currentTimeInTimezone = toZonedTime(now, timezone); // Show in selected timezone
    const utcTime = now; // Already UTC

    const newEntry = {
      id: Date.now(),
      description: currentTask,
      startTime: utcTime.toISOString(),
      isActive: true
    };

    // Save directly to localStorage for today's date (in selected timezone)
    const storageKey = getStorageDateKey(); // Use current date in selected timezone for timers
    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) {
      allData[storageKey] = [];
    }
    allData[storageKey].push(newEntry);
    saveTimesheetData(allData);

    setActiveEntry(newEntry);
    // Only update todayEntries if we're viewing today
    if (isToday()) {
      const sortedEntries = [...allData[storageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setTodayEntries(sortedEntries);
    }
    setCurrentTask('');
  };

  // Stop active timer
  const handleStop = () => {
    if (!activeEntry) return;

    // Get current time in selected timezone and convert to UTC for storage
    const now = new Date(); // Current UTC time
    const currentTimeInTimezone = toZonedTime(now, timezone); // Show in selected timezone
    const utcTime = now; // Already UTC

    const updatedEntry = {
      ...activeEntry,
      endTime: utcTime.toISOString(),
      isActive: false
    };

    // Save directly to localStorage for today's date (in selected timezone)
    const storageKey = getStorageDateKey(); // Use current date in selected timezone for timers
    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) {
      allData[storageKey] = [];
    }

    const updatedEntries = allData[storageKey].map(entry =>
      entry.id === activeEntry.id ? updatedEntry : entry
    );

    allData[storageKey] = updatedEntries;
    saveTimesheetData(allData);

    // Only update todayEntries if we're viewing today
    if (isToday()) {
      setTodayEntries(updatedEntries);
    }
    setActiveEntry(null);
  };

  // Continue a previous task (only works on current date)
  const handleContinue = (entry) => {
    if (!isToday()) {
      warning('You can only continue tasks for the current day');
      return;
    }

    // Stop any active entry first
    if (activeEntry) {
      handleStop();
    }

    // Get current time in selected timezone and convert to UTC for storage
    const now = new Date(); // Current UTC time
    const currentTimeInTimezone = toZonedTime(now, timezone); // Show in selected timezone
    const utcTime = now; // Already UTC

    const newEntry = {
      id: Date.now(),
      description: entry.description,
      project: entry.project,
      startTime: utcTime.toISOString(),
      isActive: true
    };

    // Save directly to localStorage for today's date (in selected timezone)
    const storageKey = getStorageDateKey(); // Use current date in selected timezone for timers
    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) {
      allData[storageKey] = [];
    }
    allData[storageKey].push(newEntry);
    saveTimesheetData(allData);

    setActiveEntry(newEntry);
    // Only update todayEntries if we're viewing today
    if (isToday()) {
      const sortedEntries = [...allData[storageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setTodayEntries(sortedEntries);
    }
  };

  // Modal handlers
  const handleOpenModal = (mode, entry = null) => {
    setModalState({
      isOpen: true,
      mode,
      initialData: entry
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      initialData: null
    });
  };

  // Merge entries with the same description
  const handleMergeEntries = (description) => {
    if (!window.confirm(`Merge all entries named "${description}"? This will combine them into a single entry.`)) {
      return;
    }

    const storageKey = getStorageDateKey(selectedDate);
    const allData = loadTimesheetData() || {};
    const entries = allData[storageKey] || [];

    // Find all entries with the same description
    const entriesToMerge = entries.filter(entry => entry.description === description);

    if (entriesToMerge.length < 2) {
      warning('Need at least 2 entries to merge');
      return;
    }

    // Calculate the earliest start time and latest end time
    const startTimes = entriesToMerge.map(entry => parseISO(entry.startTime));
    const endTimes = entriesToMerge.map(entry => entry.endTime ? parseISO(entry.endTime) : new Date());

    const earliestStart = new Date(Math.min(...startTimes));
    const latestEnd = new Date(Math.max(...endTimes));

    // Create merged entry
    const mergedEntry = {
      id: Date.now(),
      description: description,
      project: entriesToMerge[0].project || '', // Use project from first entry
      task: entriesToMerge[0].task || '', // Use task from first entry
      tags: entriesToMerge[0].tags || '', // Use tags from first entry
      startTime: earliestStart.toISOString(),
      endTime: latestEnd.toISOString(),
      isActive: false
    };

    // Remove the original entries and add the merged one
    const remainingEntries = entries.filter(entry => entry.description !== description);
    remainingEntries.push(mergedEntry);

    // Sort by start time
    remainingEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    // Update storage
    allData[storageKey] = remainingEntries;
    saveTimesheetData(allData);

    // Update display
    setTodayEntries(remainingEntries);
  };

  // Find entries that have duplicates
  const findDuplicateEntries = () => {
    const descriptionCounts = {};
    todayEntries.forEach(entry => {
      const desc = entry.description;
      descriptionCounts[desc] = (descriptionCounts[desc] || 0) + 1;
    });

    // Return descriptions that appear more than once
    return Object.keys(descriptionCounts).filter(desc => descriptionCounts[desc] > 1);
  };

  const getDuplicateCount = (description) => {
    return todayEntries.filter(entry => entry.description === description).length;
  };

  const handleSaveEntry = (entryData) => {
    // Determine which timezone to use for conversion
    const timezoneToUse = entryData.timezoneMode === 'custom' ? entryData.entryTimezone : timezone;

    // Create date objects appropriately based on timezone mode
    let startDateTime, endDateTime;

    if (entryData.timezoneMode === 'selected') {
      // When using selected timezone, create the date object directly in that timezone
      // This means the times are already in the selected timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm:ss', parse(entryData.date, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryData.date, 'yyyy-MM-dd', new Date()));

      // Convert from selected timezone to UTC
      startDateTime = fromZonedTime(localStartDateTime, timezone);
      endDateTime = fromZonedTime(localEndDateTime, timezone);
    } else {
      // When using custom timezone, create date object and convert from that timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm:ss', parse(entryData.date, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryData.date, 'yyyy-MM-dd', new Date()));

      // Convert from custom timezone to UTC
      startDateTime = toZonedTime(localStartDateTime, timezoneToUse);
      endDateTime = toZonedTime(localEndDateTime, timezoneToUse);
    }

    const newEntry = {
      id: modalState.mode === 'edit' ? modalState.initialData.id : Date.now(),
      ...entryData,
      isActive: false,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString()
    };

    // Get the storage key for the entry's date
    const entryStorageKey = getStorageDateKey(entryData.date);
    const currentStorageKey = getStorageDateKey(selectedDate); // Use selected date for display

    // Load all existing data
    const allData = loadTimesheetData() || {};

    // Initialize the entry's date array if it doesn't exist
    if (!allData[entryStorageKey]) {
      allData[entryStorageKey] = [];
    }

    // Handle edit vs add
    if (modalState.mode === 'edit') {
      // If editing and the date changed, remove from old date
      if (modalState.initialData.date !== entryData.date) {
        const oldStorageKey = getStorageDateKey(modalState.initialData.date);
        if (allData[oldStorageKey]) {
          allData[oldStorageKey] = allData[oldStorageKey].filter(entry => entry.id !== modalState.initialData.id);
        }
      }

      // Update/add the entry in the new date
      const entryIndex = allData[entryStorageKey].findIndex(entry => entry.id === newEntry.id);
      if (entryIndex >= 0) {
        allData[entryStorageKey][entryIndex] = newEntry;
      } else {
        allData[entryStorageKey].push(newEntry);
      }
    } else {
      // Add new entry
      allData[entryStorageKey].push(newEntry);
    }

    // Save all data
    saveTimesheetData(allData);

    // Refresh today's entries if it's the same date
    if (entryStorageKey === currentStorageKey) {
      const sortedEntries = [...allData[entryStorageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setTodayEntries(sortedEntries);
    }

    handleCloseModal();
  };

  // Remove from localStorage
  const handleDeleteEntry = (entry) => {
    const storageKey = getStorageDateKey(entry.date || new Date());
    const allData = loadTimesheetData() || {};

    if (allData[storageKey]) {
      allData[storageKey] = allData[storageKey].filter(e => e.id !== entry.id);

      // Clean up empty date arrays
      if (allData[storageKey].length === 0) {
        delete allData[storageKey];
      }

      saveTimesheetData(allData);
    }

    // Update local state
    const updatedEntries = todayEntries.filter(e => e.id !== entry.id);
    setTodayEntries(updatedEntries);
    handleCloseModal();
  };

  // Save daily tasks to weekly timesheet
  const saveToWeeklyTimesheet = () => {
    if (activeEntry) {
      warning('Please stop the active task before saving to weekly timesheet');
      return;
    }

    if (todayEntries.length === 0) {
      warning('No tasks to save for today');
      return;
    }

    // Get completed entries for today
    const completedEntries = todayEntries.filter(entry => !entry.isActive && entry.endTime);

    if (completedEntries.length === 0) {
      warning('No completed tasks to save for today');
      return;
    }

    // Find earliest start time and latest end time in selected timezone
    const startTimes = completedEntries.map(entry => new Date(entry.startTime.toLocaleString("en-US", {timeZone: timezone})));
    const endTimes = completedEntries.map(entry => new Date(entry.endTime.toLocaleString("en-US", {timeZone: timezone})));

    const earliestStart = new Date(Math.min(...startTimes));
    const latestEnd = new Date(Math.max(...endTimes));

    // Calculate total work hours and break hours in selected timezone
    const totalWorkMinutes = completedEntries.reduce((total, entry) => {
      const start = new Date(entry.startTime.toLocaleString("en-US", {timeZone: timezone}));
      const end = new Date(entry.endTime.toLocaleString("en-US", {timeZone: timezone}));
      return total + differenceInMinutes(end, start);
    }, 0);

    const totalWorkHours = totalWorkMinutes / 60;
    const timeSpanMinutes = differenceInMinutes(latestEnd, earliestStart);
    const breakHoursDecimal = Math.max(0, (timeSpanMinutes - totalWorkMinutes) / 60);

    // Create work details from task descriptions separated by semicolons
    const workDetails = completedEntries
      .map(entry => entry.description)
      .filter(desc => desc.trim())
      .join('; ');

    // Get current weekly timesheet data
    const weeklyData = loadWeeklyTimesheet() || {};
    // Use the date from the first completed entry to ensure we save to the correct day
    const firstEntryDate = completedEntries.length > 0 ? new Date(completedEntries[0].startTime) : selectedDate;
    
    // Simple approach: use the entry date directly with timezone formatting
    const storageKey = format(firstEntryDate, 'yyyy-MM-dd');
    const dayKey = storageKey;

    // Update the day's data
    if (!weeklyData[dayKey]) {
      weeklyData[dayKey] = {
        tasks: '',
        workDetails: '',
        timeIn: '',
        timeOut: '',
        breakHours: '0'
      };
    }

    weeklyData[dayKey] = {
      ...weeklyData[dayKey],
      tasks: completedEntries.length > 0 ? `${completedEntries.length} task(s)` : '',
      workDetails: workDetails,
      timeIn: formatInTimezone(earliestStart, 'HH:mm'),
      timeOut: formatInTimezone(latestEnd, 'HH:mm'),
      breakHours: breakHoursDecimal.toFixed(2)
    };

    // Save the updated weekly timesheet
    saveWeeklyTimesheet(weeklyData);

    // Trigger refresh of weekly timesheet data
    if (onWeeklyTimesheetSave) {
      onWeeklyTimesheetSave();
    }

    success(`Successfully saved ${completedEntries.length} tasks to weekly timesheet for ${formatInTimezone(selectedDate, 'MMM d, yyyy')}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              {/* Date Navigation */}
              <div className="flex items-center justify-center space-x-4 mb-4">
                <button
                  onClick={handlePreviousDay}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="text-center">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {isToday() ? 'Today' : formatInTimezone(selectedDate, 'EEEE')}, {formatInTimezone(selectedDate, 'MMM d, yyyy')}
                  </h1>
                </div>

                <button
                  onClick={handleNextDay}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Next Day"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {!isToday() && (
                <div className="text-center">
                  <button
                    onClick={handleToday}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Back to Today
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-semibold text-gray-900">
                  {calculateDailyTotal()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Bar - Only show on current date */}
        {isToday() && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex space-x-3 mb-3">
              <input
                type="text"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleStart()}
                placeholder="What are you doing now?"
                className="flex-1 bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder-gray-400"
                disabled={false}
              />
              <button
                onClick={handleStart}
                disabled={!currentTask.trim()}
                className={`px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors ${
                  activeEntry
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                }`}
              >
                {activeEntry ? (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Start New</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Start</span>
                  </>
                )}
              </button>
              {activeEntry && (
                <button
                  onClick={handleStop}
                  className="px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <Pause className="w-5 h-5" />
                  <span>Stop</span>
                </button>
              )}
            </div>

            {/* Add Manual Entry Button */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleOpenModal('add')}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                + Add Manual Entry
              </button>
              <button
                onClick={saveToWeeklyTimesheet}
                className="px-4 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
              >
                Save to Weekly Timesheet
              </button>
            </div>
          </div>
        )}

        {/* Manual Entry Button - Show for all dates */}
        {!isToday() && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex justify-center">
              <button
                onClick={() => handleOpenModal('add')}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                + Add Manual Entry for {formatInTimezone(selectedDate, 'MMM d')}
              </button>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="space-y-3">
          {/* Active Entry */}
          {activeEntry && (
            <div className="group bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {activeEntry.description}
                  </h3>
                  <p className="text-green-700 text-sm mb-2">
                    {activeEntry.project || ''}
                  </p>
                  <div className="flex items-center space-x-4 text-green-600">
                    <span className="text-sm">
                      {formatInTimezone(parseISO(activeEntry.startTime), 'h:mm a')} - now
                    </span>
                    <span className="font-mono font-semibold">
                      {getActiveDuration(activeEntry)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleStop}
                  className="opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              </div>
            </div>
          )}

          {/* Completed Entries */}
          {(() => {
            const completedEntries = todayEntries.filter(entry => !entry.isActive);
            return completedEntries.reverse().map((entry, index) => {
              // Convert both times to the selected timezone for accurate calculation
              const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
              const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
              const duration = differenceInSeconds(endTimeInTimezone, startTimeInTimezone);

              // Calculate break time from previous entry
              const previousEntry = index < completedEntries.length - 1 ? completedEntries[index + 1] : null;
              const breakTime = calculateBreakTime(entry, previousEntry);

              return (
                <React.Fragment key={entry.id}>
                  {/* Break Time Display */}
                  {breakTime && (
                    <div className="text-center py-2">
                      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm">
                        <span className="font-medium">Break</span>
                        <span>•</span>
                        <span>{formatDisplayDuration(breakTime)}</span>
                      </div>
                    </div>
                  )}

                  {/* Entry Card */}
                  <div
                    className="group bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-all"
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {entry.description}
                      </h3>
                      <p className="text-gray-500 text-sm mb-2">
                        {entry.project || ''}
                      </p>
                      <div className="flex items-center space-x-4 text-gray-600">
                        <span className="text-sm">
                          {formatInTimezone(parseISO(entry.startTime), 'h:mm a')} - {formatInTimezone(parseISO(entry.endTime), 'h:mm a')}
                        </span>
                        <span className="font-mono">
                          {formatDisplayDuration(duration)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleContinue(entry)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                      >
                        <Play className="w-4 h-4" />
                        <span>Continue</span>
                      </button>
                      <button
                        onClick={() => handleOpenModal('edit', entry)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      {getDuplicateCount(entry.description) > 1 && (
                        <button
                          onClick={() => handleMergeEntries(entry.description)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          title={`Merge ${getDuplicateCount(entry.description)} entries`}
                        >
                          <Merge className="w-4 h-4" />
                          <span>Merge ({getDuplicateCount(entry.description)})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                </React.Fragment>
              );
            });
          })()}
        </div>

        {/* Empty State */}
        {todayEntries.length === 0 && !activeEntry && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Clock className="w-16 h-16 mx-auto mb-4" />
            </div>
            <h3 className="text-xl font-semibold text-gray-500 mb-2">
              No time entries yet
            </h3>
            <p className="text-gray-400">
              Start tracking your time by entering a task above and clicking Start
            </p>
          </div>
        )}
      </div>

      {/* Time Entry Modal */}
      <TimeEntryModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        initialData={modalState.initialData}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        onClose={handleCloseModal}
        timezone={timezone}
      />
    </div>
  );
};

export default DailyTracker;
