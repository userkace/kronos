import React, { useState, useEffect } from 'react';
import { format, differenceInSeconds, differenceInMinutes, parseISO, parse, addDays, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Play, Pause, Square, Plus, Clock, Edit, ChevronLeft, ChevronRight, Merge, Calendar } from 'lucide-react';
import TimezoneSelect from './TimezoneSelect';
import TimeEntryModal from './TimeEntryModal';
import { useToast } from '../contexts/ToastContext';
import { usePomodoro } from '../contexts/PomodoroContext';
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
import faviconManager from '../utils/faviconManager';

const DailyTracker = ({ timezone, onTimezoneChange, onWeeklyTimesheetSave = () => {} }) => {
  const { success, error, warning } = useToast();
  const { isRunning: pomodoroIsRunning } = usePomodoro();

  // Initialize favicon manager
  useEffect(() => {
    faviconManager.init();
  }, []);

  const [currentTask, setCurrentTask] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const [selectedDateEntries, setSelectedDateEntries] = useState([]); // Renamed from todayEntries
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date()); // Initialize to today in UTC
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    initialData: null
  });

  // Check if timezone is properly initialized
  const isTimezoneInitialized = timezone && timezone !== 'UTC';

  // Array of funny default task descriptions
  const funnyDefaultTasks = [
    "Sure... work!",
    "Doing important things!",
    "Adulting responsibly!",
    "Pretending to be productive!",
    "Making magic happen!",
    "Turning coffee into code!",
    "Solving world problems!",
    "Being a professional!",
    "Doing the needful!",
    "Working hard hardly working!",
    "Manifesting success!",
    "Crushing it (probably)!",
    "Business stuff!",
    "Very busy vibes!",
    "Productivity performance!"
  ];

  // Helper function to format date in selected timezone
  const formatInTimezone = (date, formatStr) => {
    // Convert the date to the selected timezone, then format
    const dateInTimezone = toZonedTime(date, timezone);
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
      const dateInTimezone = toZonedTime(date, timezone);
      return format(dateInTimezone, 'yyyy-MM-dd');
    }
    // If no date provided, use current date in selected timezone
    const nowInTimezone = getCurrentDateInTimezone();
    return format(nowInTimezone, 'yyyy-MM-dd');
  };

  /********************************************************************/
  /*                    Dropdown Suggestion Handler                   */
  /********************************************************************/

  // Get unique task descriptions from all entries for autofill
  const getUniqueTaskDescriptions = () => {
    const allData = loadTimesheetData() || {};
    const allDescriptions = new Set();

    Object.values(allData).forEach(entries => {
      entries.forEach(entry => {
        if (entry.description && entry.description.trim()) {
          allDescriptions.add(entry.description.trim());
        }
      });
    });

    return Array.from(allDescriptions).sort();
  };

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Handle input change with filtering
  const handleTaskInputChange = (e) => {
    const value = e.target.value;
    setCurrentTask(value);

    if (value.trim()) {
      const allDescriptions = getUniqueTaskDescriptions();
      const filtered = allDescriptions.filter(desc =>
        desc.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowDropdown(filtered.length > 0);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowDropdown(false);
      setFilteredSuggestions([]);
    }
  };

  // Handle keyboard navigation
  const handleTaskInputKeyDown = (e) => {
    if (!showDropdown) {
      if (e.key === 'Enter') {
        handleStart();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          setCurrentTask(filteredSuggestions[selectedSuggestionIndex]);
          setShowDropdown(false);
          setSelectedSuggestionIndex(-1);
        } else {
          handleStart();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setCurrentTask(suggestion);
    setShowDropdown(false);
    setSelectedSuggestionIndex(-1);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDropdown && !e.target.closest('.task-input-container')) {
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Helper function to clean up duplicate entries caused by timezone conversion bugs
  const cleanupDuplicateEntries = () => {
    const allData = loadTimesheetData();
    const cleanedData = {};
    const seenIds = new Set();

    Object.keys(allData).forEach(dateKey => {
      const entries = allData[dateKey];
      const validEntries = [];

      entries.forEach(entry => {
        // Skip if we've already seen this ID (true duplicates)
        if (seenIds.has(entry.id)) {
          console.log(`Skipping duplicate entry ${entry.id} from ${dateKey}`);
          return;
        }

        seenIds.add(entry.id);

        // Keep entries in their original date keys - don't recalculate based on timezone
        // This prevents entries from moving between dates on page reload
        if (!cleanedData[dateKey]) {
          cleanedData[dateKey] = [];
        }
        cleanedData[dateKey].push(entry);
      });
    });

    console.log('Cleaned data keys:', Object.keys(cleanedData));
    saveTimesheetData(cleanedData);
    return cleanedData;
  };

  // Helper function to get current date in selected timezone
  const getCurrentDateInTimezone = () => {
    // Get the current time in the selected timezone
    const now = new Date();
    return toZonedTime(now, timezone);
  };

  // Debug logging for timezone (moved after function definitions)
  console.log('=== Timezone Debug ===');
  console.log('Received timezone prop:', timezone);
  console.log('Current system timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('Current system time:', new Date());
  console.log('Current time in selected timezone:', getCurrentDateInTimezone());

  // Update selectedDate to today when timezone changes
  useEffect(() => {
    // Keep the date as UTC, only format for display
    setSelectedDate(new Date());
  }, [timezone]);

  // Run cleanup only once on mount
  useEffect(() => {
    // Clean up duplicate entries first
    cleanupDuplicateEntries();
  }, []); // Empty dependency array - run only once on mount

  // Load data from localStorage on mount and when date changes
  useEffect(() => {
    const loadData = () => {
      const loadedData = loadTimesheetData();
      const storageKey = getStorageDateKey(selectedDate);
      const displayDate = formatInTimezone(selectedDate, 'yyyy-MM-dd');

      // Debug logging
      console.log('=== DailyTracker Debug ===');
      console.log('Selected Date (raw):', selectedDate);
      console.log('Selected Date (toString):', selectedDate.toString());
      console.log('Timezone:', timezone);
      console.log('Storage Key:', storageKey);
      console.log('Display Date:', displayDate);
      console.log('Is Today:', isToday());
      console.log('Available keys in storage:', Object.keys(loadedData || {}));

      // Additional timezone debug
      console.log('=== Date Calculation Debug ===');
      console.log('Current system time:', new Date());
      console.log('Current time in selected timezone:', getCurrentDateInTimezone());
      console.log('Today in selected timezone:', formatInTimezone(new Date(), 'yyyy-MM-dd'));
      console.log('Selected date in selected timezone:', formatInTimezone(selectedDate, 'yyyy-MM-dd'));

      // Check what's actually stored for each key
      console.log('=== Storage Contents Debug ===');
      Object.keys(loadedData || {}).forEach(key => {
        console.log(`Key "${key}" has ${loadedData[key].length} entries`);
        if (loadedData[key].length > 0) {
          console.log(`  First entry:`, loadedData[key][0]);
        }
      });

      if (loadedData && loadedData[storageKey]) {
        const dayEntries = loadedData[storageKey] || [];
        console.log('Entries found for storage key:', dayEntries.length, dayEntries);
        console.log('=== State Update Debug ===');
        console.log('About to setSelectedDateEntries with', dayEntries.length, 'entries for key:', storageKey);
        // Sort entries by start time (earliest first)
        const sortedEntries = dayEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setSelectedDateEntries(sortedEntries);
        console.log('setSelectedDateEntries called with sorted entries');

        // Check for active entry (only for current date in selected timezone)
        const todayInSelectedTimezone = formatInTimezone(new Date(), 'yyyy-MM-dd');
        const isCurrentDate = todayInSelectedTimezone === displayDate;

        console.log('=== Active Entry Debug ===');
        console.log('Is Current Date:', isCurrentDate);
        console.log('Current activeEntry:', activeEntry);
        console.log('Day entries:', dayEntries);
        console.log('Active entry in data:', dayEntries.find(entry => entry.isActive));

        // Log details of all entries to see their structure
        console.log('=== Entry Details ===');
        dayEntries.forEach((entry, index) => {
          console.log(`Entry ${index}:`, {
            id: entry.id,
            description: entry.description,
            isActive: entry.isActive,
            startTime: entry.startTime,
            endTime: entry.endTime
          });
        });

        if (isCurrentDate) {
          const activeEntry = dayEntries.find(entry => entry.isActive);
          if (activeEntry) {
            console.log('Setting active entry:', activeEntry);
            setActiveEntry(activeEntry);
          } else {
            console.log('No active entry found, clearing active entry');
            setActiveEntry(null);
          }
        } else {
          console.log('Not current date, clearing active entry');
        // Only clear if there's no active timer at all
        if (!activeEntry) {
          console.log('Clearing activeEntry - no timer running');
          setActiveEntry(null);
        } else {
          console.log('Keeping activeEntry on other day:', activeEntry);
        }
      }
    } else {
      console.log('No entries found for storage key:', storageKey);
      console.log('=== State Update Debug (Empty) ===');
      console.log('About to setSelectedDateEntries with [] for key:', storageKey);
      setSelectedDateEntries([]);
      console.log('setSelectedDateEntries called with empty array');

      // Before clearing activeEntry, check if there's an active timer in any date
      let foundActive = null;
      Object.keys(loadedData).forEach(dateKey => {
        const entries = loadedData[dateKey];
        const activeInDate = entries.find(entry => entry.isActive);
        if (activeInDate) {
          foundActive = activeInDate;
          console.log('Found active entry in different date key (no entries for current):', dateKey, activeInDate);
        }
      });

      if (foundActive) {
        console.log('Setting activeEntry from different date (no entries for current):', foundActive);
        setActiveEntry(foundActive);
      } else {
        console.log('No activeEntry found anywhere, clearing');
        setActiveEntry(null);
      }
    }
    };

    loadData();

    // Add storage event listener for cross-tab synchronization
    const handleStorageChange = (e) => {
      if (e.key === 'kronos_timesheet_data') {
        console.log('Storage changed, reloading data');
        loadData();
      }
    };

    // Add polling for same-tab changes (when Pomodoro saves data)
    const pollInterval = setInterval(() => {
      const currentData = loadTimesheetData();
      const storageKey = getStorageDateKey(selectedDate);
      const currentEntries = currentData[storageKey] || [];
      
      // Check if entries have changed
      if (currentEntries.length !== selectedDateEntries.length) {
        console.log('Entries count changed, reloading data');
        loadData();
      } else {
        // Check if any entry IDs are different
        const currentIds = currentEntries.map(e => e.id).sort();
        const selectedIds = selectedDateEntries.map(e => e.id).sort();
        if (JSON.stringify(currentIds) !== JSON.stringify(selectedIds)) {
          console.log('Entries changed, reloading data');
          loadData();
        }
      }
    }, 2000); // Check every 2 seconds

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
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

  // Update current time every second for real-time display (only after timezone is initialized)
  useEffect(() => {
    if (!isTimezoneInitialized) return;

    const timer = setInterval(() => {
      setCurrentTime(getCurrentDateInTimezone());
    }, 1000);

    return () => clearInterval(timer);
  }, [timezone, isTimezoneInitialized]); // Re-create timer when timezone changes or initializes

  // Update page title with cumulative work time when Daily Tracker is active (only after timezone is initialized)
  useEffect(() => {
    if (!isTimezoneInitialized) return;

    const updateWorkTimeTitle = () => {
      const totalWorkTime = calculateDailyTotal();
      document.title = `${totalWorkTime} - Kronos`;
    };

    // Update title immediately
    updateWorkTimeTitle();

    // Update title every second to reflect active timer time
    const titleTimer = setInterval(updateWorkTimeTitle, 1000);

    // Cleanup: restore original title when component unmounts
    return () => {
      clearInterval(titleTimer);
      document.title = 'Kronos';
    };
  }, [timezone, selectedDateEntries, activeEntry, currentTime, isTimezoneInitialized]); // Re-create timer when dependencies change or timezone initializes

  // Update favicon based on active entry state
  useEffect(() => {
    faviconManager.setActive(!!activeEntry);
  }, [activeEntry]);

  // Save entries to localStorage whenever they change (for timer entries only)
  useEffect(() => {
    console.log('=== Timer Save Triggered ===');
    console.log('selectedDateEntries changed, length:', selectedDateEntries.length);
    console.log('isToday():', isToday());
    console.log('selectedDate:', selectedDate.toString());

    // Only save if we have timer entries AND we're viewing today
    const hasTimerEntries = selectedDateEntries.some(entry =>
      entry.isActive || (entry.startTime && !entry.date) // Timer entries don't have a date field
    );

    console.log('hasTimerEntries:', hasTimerEntries);

    if (hasTimerEntries && isToday()) {
      const storageKey = getStorageDateKey(); // Use current date in selected timezone
      const displayDate = formatInTimezone(getCurrentDateInTimezone(), 'yyyy-MM-dd');
      console.log('=== Timer Save Debug ===');
      console.log('Saving timer entries...');
      console.log('Current selectedDateEntries:', selectedDateEntries);
      console.log('Storage key for timer save:', storageKey);
      console.log('Currently viewing date:', formatInTimezone(selectedDate, 'yyyy-MM-dd'));
      console.log('Is today:', isToday());

      const allData = loadTimesheetData() || {};
      allData[storageKey] = selectedDateEntries;

      saveTimesheetData(allData);
      console.log('Timer entries saved to key:', storageKey);
    } else {
      console.log('Timer save skipped - conditions not met');
    }
  }, [selectedDateEntries, timezone]); // Re-save only when entries or timezone changes, NOT when selectedDate changes

  // Calculate duration for active entry
  const getActiveDuration = (entry) => {
    if (!entry) return '0:00:00';

    // Convert both times to the selected timezone for accurate calculation
    const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
    const currentTimeInTimezone = currentTime; // Use the updated currentTime state

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

  // Format break time with seconds always included
  const formatBreakDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ${remainingSeconds}s` : `${hours}h ${remainingSeconds}s`;
  };

  // Calculate break time between two consecutive entries
  const calculateBreakTime = (currentEntry, previousEntry) => {
    if (!currentEntry || !previousEntry || !previousEntry.endTime || !currentEntry.startTime) return null;

    const prevEndInTimezone = toZonedTime(parseISO(previousEntry.endTime), timezone);
    const currentStartInTimezone = toZonedTime(parseISO(currentEntry.startTime), timezone);

    const breakSeconds = differenceInSeconds(currentStartInTimezone, prevEndInTimezone);

    // Only show breaks longer than 10 seconds to avoid noise
    if (breakSeconds <= 10) return null;

    return breakSeconds;
  };

  // Calculate total daily time
  const calculateDailyTotal = () => {
    let totalSeconds = 0;

    // Add completed entries
    selectedDateEntries.forEach(entry => {
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
      const currentTimeInTimezone = toZonedTime(new Date(), timezone); // Always convert fresh for timezone consistency
      totalSeconds += differenceInSeconds(currentTimeInTimezone, startTimeInTimezone);
    }

    return formatDisplayDuration(totalSeconds);
  };

  // Start new timer (only works on current date)
  const handleStart = () => {
    // Prevent starting if Pomodoro is running
    if (pomodoroIsRunning) {
      warning('Cannot start timer while Pomodoro is active');
      return;
    }

    const taskToStart = currentTask.trim() || funnyDefaultTasks[Math.floor(Math.random() * funnyDefaultTasks.length)];

    if (!taskToStart) return;
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
      description: taskToStart,
      startTime: utcTime.toISOString(),
      isActive: true
    };

    // Save directly to localStorage for today's date (in selected timezone)
    const storageKey = getStorageDateKey(); // Use current date in selected timezone for timers
    console.log('=== Timer Save Debug ===');
    console.log('Saving timer with storage key:', storageKey);
    console.log('Current date:', new Date());
    console.log('Current date in timezone:', getCurrentDateInTimezone());

    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) {
      allData[storageKey] = [];
    }
    allData[storageKey].push(newEntry);
    saveTimesheetData(allData);

    setActiveEntry(newEntry);
    // Only update selectedDateEntries if we're viewing today
    if (isToday()) {
      const sortedEntries = [...allData[storageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setSelectedDateEntries(sortedEntries);
    }
    // Only clear input if it was empty (using funny default)
    if (!currentTask.trim()) {
      setCurrentTask('');
    }
  };

  // Stop active timer
  const handleStop = () => {
    if (!activeEntry) return;

    // Get current time in selected timezone and convert to UTC for storage
    const now = new Date(); // Current UTC time
    const currentTimeInTimezone = toZonedTime(now, timezone); // Show in selected timezone
    const utcTime = now; // Already UTC

    // Use the timer's start time to determine the correct storage date key
    // This prevents issues when timezone rolls over to a new day
    const timerStartDate = format(toZonedTime(parseISO(activeEntry.startTime), timezone), 'yyyy-MM-dd');
    const currentDateInTimezone = format(currentTimeInTimezone, 'yyyy-MM-dd');
    const storageKey = getStorageDateKey(timerStartDate);
    
    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) {
      allData[storageKey] = [];
    }

    // Stop the current day's task at midnight if timezone rolled over
    let stopTime = utcTime;
    let shouldCreateNewTask = false;

    if (timerStartDate !== currentDateInTimezone) {
      // Timezone rolled over - stop the task at 23:59:59 of the previous day
      const timerStartBaseDate = parse(timerStartDate, 'yyyy-MM-dd', new Date());
      const endOfPreviousDayInTimezone = parse('23:59:59', 'HH:mm:ss', timerStartBaseDate);
      const endOfPreviousDayUTC = fromZonedTime(endOfPreviousDayInTimezone, timezone);
      stopTime = endOfPreviousDayUTC;
      shouldCreateNewTask = true;
    }

    const updatedEntry = {
      ...activeEntry,
      endTime: stopTime.toISOString(),
      isActive: false
    };

    const updatedEntries = allData[storageKey].map(entry =>
      entry.id === activeEntry.id ? updatedEntry : entry
    );

    allData[storageKey] = updatedEntries;
    saveTimesheetData(allData);

    // Create completed task for the new day if timezone rolled over
    if (shouldCreateNewTask) {
      // Calculate midnight of the current day in timezone
      const currentDateBase = parse(currentDateInTimezone, 'yyyy-MM-dd', new Date());
      const midnightInTimezone = parse('00:00:00', 'HH:mm:ss', currentDateBase);
      const midnightUTC = fromZonedTime(midnightInTimezone, timezone);
      
      // Create the today/present segment (midnight to current time)
      const todayEntry = {
        id: Date.now(),
        description: activeEntry.description,
        project: activeEntry.project,
        task: activeEntry.task,
        tags: activeEntry.tags,
        startTime: midnightUTC.toISOString(), // Start from midnight
        endTime: utcTime.toISOString(), // End at current time
        isActive: false // Not active - completed in one operation
      };

      const newStorageKey = getStorageDateKey(currentDateInTimezone);
      if (!allData[newStorageKey]) {
        allData[newStorageKey] = [];
      }
      allData[newStorageKey].push(todayEntry);
      saveTimesheetData(allData);
      
      // Update display to show the current day's entries if we're viewing today
      if (isToday()) {
        const newDateEntries = allData[newStorageKey] || [];
        const sortedNewEntries = newDateEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setSelectedDateEntries(sortedNewEntries);
      }
      
      success(`Task time recorded for both ${timerStartDate} and ${currentDateInTimezone}`);
    }
    
    setActiveEntry(null);

    // Update display if we're viewing the timer's original date
    const selectedDateKey = getStorageDateKey(selectedDate);
    if (selectedDateKey === storageKey && !shouldCreateNewTask) {
      setSelectedDateEntries(updatedEntries);
    }
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
    // Only update selectedDateEntries if we're viewing today
    if (isToday()) {
      const sortedEntries = [...allData[storageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setSelectedDateEntries(sortedEntries);
    }
  };

  // Modal handlers
  const handleOpenModal = (mode, entry = null) => {
    // Prevent opening modal if Pomodoro is running
    if (pomodoroIsRunning && mode === 'add') {
      warning('Cannot add manual entries while Pomodoro is active');
      return;
    }
    
    setModalState({
      isOpen: true,
      mode,
      initialData: entry,
      selectedDate: selectedDate // Pass selected date to modal
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      initialData: null
    });
  };

  // Check if merging should be disabled for a description
  const shouldDisableMerge = (description) => {
    const storageKey = getStorageDateKey(selectedDate);
    const allData = loadTimesheetData() || {};
    const entries = allData[storageKey] || [];

    // Find all entries with the same description
    const entriesToMerge = entries.filter(entry => entry.description === description);

    if (entriesToMerge.length < 2) return true;

    // Check if any entry is from pomodoro source - disable merging for pomodoro entries
    const hasPomodoroEntries = entriesToMerge.some(entry => entry.source === 'pomodoro');
    if (hasPomodoroEntries) return true;

    // Check if any entry is active
    if (entriesToMerge.some(entry => entry.isActive)) return true;

    // Sort entries by start time
    const sortedEntries = entriesToMerge.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    // Check if entries are split by other entries
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const currentEntry = sortedEntries[i];
      const nextEntry = sortedEntries[i + 1];
      
      // Get all entries between current and next
      const entriesBetween = entries.filter(entry => 
        new Date(entry.startTime) > new Date(currentEntry.startTime) &&
        new Date(entry.startTime) < new Date(nextEntry.startTime)
      );
      
      if (entriesBetween.length > 0) return true;
    }

    return false;
  };

  // Check if entries contain pomodoro source for tooltip
  const hasPomodoroSource = (description) => {
    const storageKey = getStorageDateKey(selectedDate);
    const allData = loadTimesheetData() || {};
    const entries = allData[storageKey] || [];
    const entriesToMerge = entries.filter(entry => entry.description === description);
    return entriesToMerge.some(entry => entry.source === 'pomodoro');
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
    setSelectedDateEntries(remainingEntries);
  };

  // Find entries that have duplicates
  const findDuplicateEntries = () => {
    const descriptionCounts = {};
    selectedDateEntries.forEach(entry => {
      const desc = entry.description;
      descriptionCounts[desc] = (descriptionCounts[desc] || 0) + 1;
    });

    // Return descriptions that appear more than once
    return Object.keys(descriptionCounts).filter(desc => descriptionCounts[desc] > 1);
  };

  const getDuplicateCount = (description) => {
    return selectedDateEntries.filter(entry => entry.description === description).length;
  };

  const handleSaveEntry = (entryData) => {
    // Determine which timezone to use for conversion
    const timezoneToUse = entryData.timezoneMode === 'custom' ? entryData.entryTimezone : timezone;

    // Use the selected date instead of entryData.date
    const entryDate = formatInTimezone(selectedDate, 'yyyy-MM-dd');

    // Create date objects appropriately based on timezone mode
    let startDateTime, endDateTime;

    if (entryData.timezoneMode === 'selected') {
      // When using selected timezone, create the date object directly in that timezone
      // This means the times are already in the selected timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm', parse(entryDate, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm', parse(entryDate, 'yyyy-MM-dd', new Date()));

      // Convert from selected timezone to UTC
      startDateTime = fromZonedTime(localStartDateTime, timezone);
      endDateTime = fromZonedTime(localEndDateTime, timezone);
    } else {
      // When using custom timezone, create date object and convert from that timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm', parse(entryDate, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm', parse(entryDate, 'yyyy-MM-dd', new Date()));

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

    // Remove date field from entry to match timer format
    delete newEntry.date;

    // Get the storage key for the selected date
    const entryStorageKey = getStorageDateKey(entryDate);
    const currentStorageKey = getStorageDateKey(selectedDate); // Use selected date for display

    // Load all existing data
    const allData = loadTimesheetData() || {};

    // Initialize the entry's date array if it doesn't exist
    if (!allData[entryStorageKey]) {
      allData[entryStorageKey] = [];
    }

    // Handle edit vs add
    if (modalState.mode === 'edit') {
      // For editing, we need to find the original entry's date from startTime
      const originalDate = format(toZonedTime(parseISO(modalState.initialData.startTime), timezone), 'yyyy-MM-dd');
      const oldStorageKey = getStorageDateKey(originalDate);

      // If editing and the date changed, remove from old date
      if (oldStorageKey !== entryStorageKey) {
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
      setSelectedDateEntries(sortedEntries);
    }

    handleCloseModal();
  };

  // Remove from localStorage
  const handleDeleteEntry = (entry) => {
    // Use startTime to determine the storage key instead of date field
    const entryDate = format(toZonedTime(parseISO(entry.startTime), timezone), 'yyyy-MM-dd');
    const storageKey = getStorageDateKey(entryDate);
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
    const updatedEntries = selectedDateEntries.filter(e => e.id !== entry.id);
    setSelectedDateEntries(updatedEntries);
    handleCloseModal();
  };

  // Merge overlapping time periods to calculate accurate total work time
  const mergeOverlappingPeriods = (entries) => {
    if (entries.length === 0) return [];

    // Convert entries to time periods in selected timezone, normalized to minutes
    const periods = entries.map(entry => {
      const start = toZonedTime(parseISO(entry.startTime), timezone);
      const end = toZonedTime(parseISO(entry.endTime), timezone);

      // Normalize to minute precision (zero out seconds and milliseconds)
      const normalizedStart = new Date(start);
      normalizedStart.setSeconds(0, 0);

      const normalizedEnd = new Date(end);
      normalizedEnd.setSeconds(0, 0);

      return {
        start: normalizedStart,
        end: normalizedEnd
      };
    });

    // Sort by start time
    periods.sort((a, b) => a.start - b.start);

    // Merge overlapping periods
    const merged = [];
    let current = periods[0];

    for (let i = 1; i < periods.length; i++) {
      const next = periods[i];

      // If next period overlaps or touches current period (within the same minute)
      if (next.start <= current.end) {
        // Extend current period to include the next one
        current.end = new Date(Math.max(current.end, next.end));
      } else {
        // No overlap, push current and start new one
        merged.push(current);
        current = next;
      }
    }

    // Push the last period
    merged.push(current);

    return merged;
  };

  // Save daily tasks to weekly timesheet
  const saveToWeeklyTimesheet = () => {
    if (activeEntry) {
      warning('Please stop the active task before saving to weekly timesheet');
      return;
    }

    if (selectedDateEntries.length === 0) {
      warning('No tasks to save for today');
      return;
    }

    // Get completed entries for today
    const completedEntries = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);

    if (completedEntries.length === 0) {
      warning('No completed tasks to save for today');
      return;
    }

    // Find earliest start time and latest end time in selected timezone
    const startTimes = completedEntries.map(entry => toZonedTime(parseISO(entry.startTime), timezone));
    const endTimes = completedEntries.map(entry => toZonedTime(parseISO(entry.endTime), timezone));

    // Find the earliest and latest times while preserving timezone
    const earliestStart = startTimes.reduce((earliest, current) =>
      current < earliest ? current : earliest, startTimes[0]);
    const latestEnd = endTimes.reduce((latest, current) =>
      current > latest ? current : latest, endTimes[0]);

    // Normalize to minute precision for consistency
    earliestStart.setSeconds(0, 0);
    latestEnd.setSeconds(0, 0);

    // Calculate total work hours using merged overlapping periods
    const mergedPeriods = mergeOverlappingPeriods(completedEntries);

    console.log('=== Break Calculation Debug ===');
    console.log('Original entries:', completedEntries.length);
    console.log('Merged periods:', mergedPeriods.length);
    mergedPeriods.forEach((period, index) => {
      console.log(`Period ${index}: ${period.start.toISOString()} - ${period.end.toISOString()}`);
    });

    const totalWorkMinutes = mergedPeriods.reduce((total, period) => {
      return total + differenceInMinutes(period.end, period.start);
    }, 0);

    const totalWorkHours = totalWorkMinutes / 60;
    const timeSpanMinutes = differenceInMinutes(latestEnd, earliestStart);
    const breakHoursDecimal = Math.max(0, (timeSpanMinutes - totalWorkMinutes) / 60);

    console.log('Earliest start:', earliestStart.toISOString());
    console.log('Latest end:', latestEnd.toISOString());
    console.log('Time span minutes:', timeSpanMinutes);
    console.log('Total work minutes:', totalWorkMinutes);
    console.log('Break hours decimal:', breakHoursDecimal);

    // Create work details from unique task descriptions separated by semicolons
    // This avoids duplicates when entries with the same description are split apart
    const uniqueDescriptions = [...new Set(
      completedEntries
        .map(entry => entry.description)
        .filter(desc => desc.trim())
    )];
    const workDetails = uniqueDescriptions.join('; ');

    // Get current weekly timesheet data
    const weeklyData = loadWeeklyTimesheet() || {};
    // Use the date from the first completed entry to ensure we save to the correct day
    const firstEntryDate = completedEntries.length > 0 ? toZonedTime(parseISO(completedEntries[0].startTime), timezone) : selectedDate;

    // Use the entry date in the selected timezone for storage key
    const storageKey = format(firstEntryDate, 'yyyy-MM-dd');
    const dayKey = storageKey;

    console.log('=== Weekly Save Debug ===');
    console.log('First entry start time (ISO):', completedEntries[0]?.startTime);
    console.log('First entry date in timezone:', firstEntryDate);
    console.log('Storage key for weekly:', storageKey);
    console.log('Selected date:', selectedDate);

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
      timeIn: format(earliestStart, 'HH:mm'),
      timeOut: format(latestEnd, 'HH:mm'),
      breakHours: breakHoursDecimal.toFixed(2)
    };

    console.log('=== Weekly Timesheet Save Debug ===');
    console.log('Earliest start (raw):', earliestStart.toISOString());
    console.log('Latest end (raw):', latestEnd.toISOString());
    console.log('Timezone:', timezone);
    console.log('Time In (saved):', format(earliestStart, 'HH:mm'));
    console.log('Time Out (saved):', format(latestEnd, 'HH:mm'));
    console.log('Break Hours (saved):', breakHoursDecimal.toFixed(2));

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
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {isToday() ? 'Today' : formatInTimezone(selectedDate, 'EEEE')}, {formatInTimezone(selectedDate, 'MMM d, yyyy')}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePreviousDay}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={handleToday}
                className={`p-2 rounded-lg transition-colors ${
                  isToday()
                    ? 'cursor-not-allowed'
                    : 'hover:bg-gray-200'
                }`}
                title={isToday() ? "Current day" : "Back to Today"}
                disabled={isToday()}
              >
                <div className={`w-2 h-2 rounded-full ${isToday() ? 'bg-gray-400' : 'bg-blue-600'}`}></div>
              </button>

              <button
                onClick={handleNextDay}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="w-5 h-5" />
            <span className="text-2xl font-semibold text-gray-900">
              {calculateDailyTotal()}
            </span>
          </div>
        </div>

        {/* Input Bar - Only show on current date */}
        {isToday() && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-start space-x-3 mb-3">
              <div className="flex-1 relative task-input-container">
                <input
                  type="text"
                  value={currentTask}
                  onChange={handleTaskInputChange}
                  onKeyDown={handleTaskInputKeyDown}
                  onFocus={() => {
                    if (currentTask.trim() && filteredSuggestions.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                  placeholder="What are you doing now?"
                  className={`w-full bg-white text-gray-900 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-offset-0 focus:ring-offset-white relative z-20 placeholder-gray-400 ${
                    activeEntry
                      ? 'focus:ring-blue-500 focus:border-blue-500'
                      : 'focus:ring-green-500 focus:border-green-500'
                  }`}
                disabled={false}
                autoComplete="off"
                />

                {/* Custom Dropdown */}
                {showDropdown && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-2 cursor-pointer transition-colors ${
                          index === selectedSuggestionIndex
                            ? 'bg-blue-50 text-blue-900'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleStart}
                disabled={pomodoroIsRunning}
                className={`px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors ${
                  pomodoroIsRunning
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : activeEntry
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title={pomodoroIsRunning ? 'Cannot start timer while Pomodoro is active' : ''}
              >
                {activeEntry ? (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>New</span>
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
                  <Square className="w-5 h-5" />
                  <span>Stop</span>
                </button>
              )}
            </div>

            {/* Add Manual Entry Button */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleOpenModal('add')}
                disabled={pomodoroIsRunning}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  pomodoroIsRunning
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title={pomodoroIsRunning ? 'Cannot add manual entries while Pomodoro is active' : ''}
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
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleOpenModal('add')}
                disabled={pomodoroIsRunning}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  pomodoroIsRunning
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title={pomodoroIsRunning ? 'Cannot add manual entries while Pomodoro is active' : ''}
              >
                + Add Manual Entry for {formatInTimezone(selectedDate, 'MMM d')}
              </button>
              {selectedDateEntries.length > 0 && (
                <button
                  onClick={saveToWeeklyTimesheet}
                  className="px-4 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                >
                  Save to Weekly Timesheet
                </button>
              )}
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
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {activeEntry.description}
                    </h3>
                  </div>
                  <p className="text-green-700 text-sm mb-2">
                    {activeEntry.project || ''}
                  </p>
                  <div className="flex items-center space-x-4 text-green-600">
                    {!isToday() && (
                      <>
                        <span className="text-sm font-medium">
                          {formatInTimezone(currentTime, 'MMMM d')}
                        </span>
                      </>
                    )}
                    <span className="text-sm">
                      {formatInTimezone(parseISO(activeEntry.startTime), 'h:mm a')} - now
                    </span>
                    <span className="font-mono font-semibold">
                      {getActiveDuration(activeEntry)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={handleStop}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pause</span>
                    </button>
                  </div>
                  {!isToday() && (
                    <button
                      onClick={handleToday}
                      className="px-4 py-2.5 text-sm font-medium bg-green-100 text-green-800 rounded-lg group-hover:bg-green-200 hover:bg-green-300/60 transition-colors cursor-pointer flex items-center space-x-2"
                      title="Back to Today"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Today</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Break Time Display between running and previous entry */}
          {(() => {
            const completedEntriesAsc = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);
            if (activeEntry && completedEntriesAsc.length > 0) {
              const lastCompleted = completedEntriesAsc[completedEntriesAsc.length - 1];
              const breakTimeBetweenActiveAndLast = calculateBreakTime(activeEntry, lastCompleted);
              if (breakTimeBetweenActiveAndLast) {
                return (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm">
                      <span className="font-medium">Break</span>
                      <span>•</span>
                      <span>{formatBreakDuration(breakTimeBetweenActiveAndLast)}</span>
                    </div>
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* Completed Entries */}
          {(() => {
            const completedEntriesAsc = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);
            const displayEntries = completedEntriesAsc.slice().reverse();

            return displayEntries.map((entry, index) => {
              // Convert both times to the selected timezone for accurate calculation
              const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
              const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
              const duration = differenceInSeconds(endTimeInTimezone, startTimeInTimezone);

              const previousEntry = index < displayEntries.length - 1 ? displayEntries[index + 1] : null;
              const breakTime = calculateBreakTime(entry, previousEntry);

              return (
                <React.Fragment key={entry.id}>
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
                          disabled={shouldDisableMerge(entry.description)}
                          className={`px-3 py-2 rounded-lg flex items-center space-x-1 ${
                            shouldDisableMerge(entry.description)
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                          title={
                            shouldDisableMerge(entry.description)
                              ? hasPomodoroSource(entry.description)
                                ? 'Cannot merge: Pomodoro entries cannot be merged'
                                : 'Cannot merge: entries are split by other tasks or contain active entries'
                              : `Merge ${getDuplicateCount(entry.description)} entries`
                          }
                        >
                          <Merge className="w-4 h-4" />
                          <span>Merge ({getDuplicateCount(entry.description)})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Break Time Display between this entry and the previous older entry */}
                {breakTime && (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm">
                      <span className="font-medium">Break</span>
                      <span>•</span>
                      <span>{formatBreakDuration(breakTime)}</span>
                    </div>
                  </div>
                )}
                </React.Fragment>
              );
            });
          })()}
        </div>

        {/* Empty State */}
        {selectedDateEntries.length === 0 && !activeEntry && (
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
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default DailyTracker;
