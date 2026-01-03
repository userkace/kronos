import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInSeconds, differenceInMinutes, parseISO, parse, addDays, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Play, Pause, Square, Plus, Clock, Edit, ChevronLeft, ChevronRight, Merge, ArrowUp, ArrowDown, Calendar, Coffee } from 'lucide-react';
import DatePicker from './molecules/DatePicker';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import TimezoneSelect from './TimezoneSelect';
import TimeEntryModal from './TimeEntryModal';
import { useToast } from '../contexts/ToastContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useUnifiedDisplay } from '../hooks/useUnifiedDisplay';
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
import storageEventSystem from '../utils/storageEvents';

const DailyTracker = ({ timezone, onTimezoneChange, onWeeklyTimesheetSave = () => {} }) => {
  const { success, error, warning } = useToast();
  const { isRunning: pomodoroIsRunning } = usePomodoro();

  // Initialize favicon manager
  useEffect(() => {
    faviconManager.init();
  }, []);

  // State for the current task input and active entry
  const [currentTask, setCurrentTask] = useState('');
  const {
    sortOrder,
    changeSortOrder,
    showBreaks,
    toggleShowBreaks
  } = useUserPreferences();
  const [activeEntry, setActiveEntry] = useState(null);
  const [selectedDateEntries, setSelectedDateEntries] = useState([]); // Renamed from todayEntries
  const currentTimeRef = useRef(new Date());
  const [_, setCurrentTime] = useState(0); // Just for triggering re-renders
  const [selectedDate, setSelectedDate] = useState(new Date()); // Initialize to today in UTC
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    initialData: null
  });

  // Check if timezone is properly initialized
  const isTimezoneInitialized = timezone && timezone !== 'UTC';

  // State for calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get calendar days for the current month view, memoized to prevent unnecessary recalculations
  const calendarDays = React.useMemo(() => {
    // Use the original date for year/month calculation to avoid timezone offset issues
    const originalDate = new Date(currentMonth);
    const year = originalDate.getFullYear();
    const month = originalDate.getMonth();

    // Convert to target timezone for day-of-week calculations only
    const zonedFirstDay = toZonedTime(new Date(Date.UTC(year, month, 1)), timezone);

    // Day of week of first day (0 = Sunday, 6 = Saturday) in target timezone
    const firstDayOfWeek = zonedFirstDay.getDay();

    // Total days in month - use UTC calculation which is consistent across timezones
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // Calculate days to show from previous month
    const daysFromPrevMonth = firstDayOfWeek;

    // Calculate total days to show - always ensure 6 rows (42 days) for consistent layout
    const totalDaysToShow = 42;
    const daysFromNextMonth = totalDaysToShow - (daysInMonth + daysFromPrevMonth);

    const days = [];

    // Add days from previous month
    if (daysFromPrevMonth > 0) {
      const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let i = 0; i < daysFromPrevMonth; i++) {
        const day = new Date(Date.UTC(year, month - 1, prevMonthDays - daysFromPrevMonth + i + 1));
        days.push(day);
      }
    }

    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(Date.UTC(year, month, i)));
    }

    // Add days from next month if needed
    if (daysFromNextMonth > 0) {
      for (let i = 1; i <= daysFromNextMonth; i++) {
        days.push(new Date(Date.UTC(year, month + 1, i)));
      }
    }

    return days;
  }, [currentMonth, timezone]);

  // Handle month navigation
  const handleMonthChange = (increment) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setCurrentMonth(newMonth);
  };

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

    saveTimesheetData(cleanedData);
    return cleanedData;
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

      if (loadedData && loadedData[storageKey]) {
        const dayEntries = loadedData[storageKey] || [];
        // Sort entries by start time (earliest first)
        const sortedEntries = dayEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setSelectedDateEntries(sortedEntries);

        // Check for active entry (only for current date in selected timezone)
        const todayInSelectedTimezone = formatInTimezone(new Date(), 'yyyy-MM-dd');
        const isCurrentDate = todayInSelectedTimezone === displayDate;

        if (isCurrentDate) {
          const activeEntry = dayEntries.find(entry => entry.isActive);
          if (activeEntry) {
            setActiveEntry(activeEntry);
          } else {
            setActiveEntry(null);
          }
        } else {
          // Only clear if there's no active timer at all
          if (!activeEntry) {
            setActiveEntry(null);
          }
        }
    } else {
      setSelectedDateEntries([]);

      // Before clearing activeEntry, check if there's an active timer in any date
      let foundActive = null;
      Object.keys(loadedData).forEach(dateKey => {
        const entries = loadedData[dateKey];
        const activeInDate = entries.find(entry => entry.isActive);
        if (activeInDate) {
          foundActive = activeInDate;
        }
      });

      if (foundActive) {
        setActiveEntry(foundActive);
      } else {
        setActiveEntry(null);
      }
    }
    };

    loadData();

    // Subscribe to storage changes using the event system
    const unsubscribe = storageEventSystem.subscribe('kronos_timesheet_data', () => {
      loadData();
    });

    return () => {
      unsubscribe();
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

  // Update current time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = new Date();
      setCurrentTime(prev => prev + 1); // Just increment to trigger re-render
    }, 1000);

    return () => clearInterval(timer);
  }, []); // No dependencies - runs once on mount

  // Memoize the updateWorkTimeTitle function
  const updateWorkTimeTitle = useCallback(() => {
    setCurrentTime(prev => prev + 1);
    const totalWorkTime = calculateDailyTotal();
    document.title = `${totalWorkTime} - Kronos`;
  }, [timezone, selectedDateEntries, activeEntry, isTimezoneInitialized]);

  // Update page title with cumulative work time when Daily Tracker is active
  useEffect(() => {
    if (!isTimezoneInitialized) return;

    // Initial update
    updateWorkTimeTitle();

    // Update title every second to reflect active timer time
    const titleTimer = setInterval(updateWorkTimeTitle, 1000);

    // Cleanup: restore original title when component unmounts
    return () => {
      clearInterval(titleTimer);
      document.title = 'Kronos';
    };
  }, [updateWorkTimeTitle, isTimezoneInitialized]);

  // Update favicon based on active entry state
  useEffect(() => {
    faviconManager.setActive(!!activeEntry);
  }, [activeEntry]);

  // Save entries to localStorage whenever they change (for timer entries only)
  useEffect(() => {
    // Only save if we have timer entries AND we're viewing today
    const hasTimerEntries = selectedDateEntries.some(entry =>
      entry.isActive || (entry.startTime && !entry.date) // Timer entries don't have a date field
    );

    if (hasTimerEntries && isToday()) {
      const storageKey = getStorageDateKey(); // Use current date in selected timezone

      const allData = loadTimesheetData() || {};
      allData[storageKey] = selectedDateEntries;
      saveTimesheetData(allData);
    }
  }, [selectedDateEntries, timezone]); // Re-save only when entries or timezone changes, NOT when selectedDate changes

  // Memoized break total calculation to avoid expensive recalculation on every render
  const breakTotal = useMemo(() => {
    return calculateDailyBreakTotal();
  }, [selectedDateEntries, activeEntry, calculateBreakTime]);

  // Calculate duration for active entry
  const getActiveDuration = (entry) => {
    if (!entry) return '0:00:00';

    // Convert both times to the selected timezone for accurate calculation
    const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
    const currentTimeInTimezone = toZonedTime(currentTimeRef.current, timezone);

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
      const currentTimeInTimezone = toZonedTime(currentTimeRef.current, timezone); // Use the ref for consistent time
      totalSeconds += differenceInSeconds(currentTimeInTimezone, startTimeInTimezone);
    }

    return formatDisplayDuration(totalSeconds);
  };

  // Calculate total break time for the day
  const calculateDailyBreakTotal = () => {
    let totalBreakSeconds = 0;

    // Get completed entries only (filter out active entries), then sort by start time
    const completedEntries = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);
    const allEntries = [...completedEntries].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    // Add active entry to the list if it exists
    if (activeEntry) {
      allEntries.push(activeEntry);
    }

    // Calculate break times between consecutive entries
    for (let i = 1; i < allEntries.length; i++) {
      const currentEntry = allEntries[i];
      const previousEntry = allEntries[i - 1];

      // Only calculate break if previous entry has an end time
      if (previousEntry.endTime && !previousEntry.isActive) {
        const breakTime = calculateBreakTime(currentEntry, previousEntry);
        if (breakTime) {
          totalBreakSeconds += breakTime;
        }
      }
    }

    return formatDisplayDuration(totalBreakSeconds);
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

    // Prevent continuing if Pomodoro is running
    if (pomodoroIsRunning) {
      warning('Cannot continue timer while Pomodoro is active');
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
      const localStartDateTime = parse(entryData.startTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));

      // Convert from selected timezone to UTC
      startDateTime = fromZonedTime(localStartDateTime, timezone);
      endDateTime = fromZonedTime(localEndDateTime, timezone);
    } else {
      // When using custom timezone, create date object and convert from that timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));
      const localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));

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

    const totalWorkMinutes = mergedPeriods.reduce((total, period) => {
      return total + differenceInMinutes(period.end, period.start);
    }, 0);

    const totalWorkHours = totalWorkMinutes / 60;
    const timeSpanMinutes = differenceInMinutes(latestEnd, earliestStart);
    const breakHoursDecimal = Math.max(0, (timeSpanMinutes - totalWorkMinutes) / 60);

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

    // Save the updated weekly timesheet
    saveWeeklyTimesheet(weeklyData);

    // Trigger refresh of weekly timesheet data
    if (onWeeklyTimesheetSave) {
      onWeeklyTimesheetSave();
    }

    success(`Successfully saved ${completedEntries.length} tasks to weekly timesheet for ${formatInTimezone(selectedDate, 'MMM d, yyyy')}`);
  };

  // Memoized unified display computation for entries and breaks
  const unifiedDisplay = useUnifiedDisplay(
    activeEntry,
    selectedDateEntries,
    sortOrder,
    showBreaks,
    calculateBreakTime
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <h1 className="text-3xl font-bold text-gray-900">
                    <span className="sm:hidden">{formatInTimezone(selectedDate, 'MMM. d, yyyy')}</span>
                    <span className="hidden sm:inline">{formatInTimezone(selectedDate, 'MMMM d, yyyy')}</span>
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${isToday() ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                  {isToday() ? 'Today' : formatInTimezone(selectedDate, 'EEEE')}
                </span>
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
                className={`p-2 rounded-lg transition-colors ${
                  isToday()
                    ? 'cursor-not-allowed text-gray-400'
                    : 'hover:bg-gray-200'
                }`}
                title={isToday() ? "Current day" : "Next Day"}
                disabled={isToday()}
              >
                <ChevronRight className="w-5 h-5" />
              </button>

            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-baseline space-x-2 text-gray-600">
                <Clock className="w-5 h-5 self-center mt-1" />
                <span className="text-2xl font-semibold text-gray-900">
                  {calculateDailyTotal()}
                </span>
              </div>
              <AnimatePresence>
                {showBreaks && breakTotal !== '0s' && (
                  <motion.span
                    key="break-total"
                    initial={{ opacity: 0, scale: 0, x: -50 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-600"
                  >
                    <Coffee className="w-4 h-4 mr-2" />
                    {breakTotal}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => changeSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'Newest first' : 'Oldest first'}`}
                aria-label={`Sort ${sortOrder === 'asc' ? 'Newest first' : 'Oldest first'}`}
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp className="w-5 h-5" />
                ) : (
                  <ArrowDown className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={toggleShowBreaks}
                className={`p-2 rounded-lg transition-colors ${
                  showBreaks
                    ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
                title={showBreaks ? 'Hide break times' : 'Show break times'}
                aria-label={showBreaks ? 'Hide break times' : 'Show break times'}
                aria-pressed={showBreaks}
              >
                <Coffee className="w-5 h-5" />
              </button>
              <DatePicker
                selectedDate={selectedDate}
                onDateChange={(date) => {
                  setSelectedDate(date);
                  // Only update the month if the selected date is in a different month
                  const newMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                  if (newMonth.getMonth() !== currentMonth.getMonth() ||
                      newMonth.getFullYear() !== currentMonth.getFullYear()) {
                    setCurrentMonth(newMonth);
                  }
                }}
                onMonthChange={handleMonthChange}
                calendarDays={calendarDays}
              />
            </div>
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
                className={`p-3 rounded-full font-semibold flex items-center space-x-2 transition-colors ${
                  pomodoroIsRunning
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : activeEntry
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title={pomodoroIsRunning ? 'Cannot start timer while Pomodoro is active' : ''}
              >
                {activeEntry ? (
                  <Plus className="w-5 h-5" />
                ) : (
                    <Play className="w-5 h-5" />
                )}
              </button>
              {activeEntry && (
                <button
                  onClick={handleStop}
                  className="p-3 rounded-lg font-semibold flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <Square className="w-5 h-5" />
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
          {/* Unified Task Entries with Layout Animation */}
          <AnimatePresence mode="popLayout">
            {unifiedDisplay.map((item, index) => {
                // Handle unexpected item types with warning and fallback
                if (!item || !item.type) {
                  warning('Invalid entry detected in task list');
                }

                if (item.type === 'active') {
                  // Validate active item has required data and ID
                  if (!item.data || !item.data.id) {
                    error('Invalid active entry detected - missing required data');
                  }

                  return (
                    <motion.div
                      key={`active-${item.data.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      layout
                    >
                      <div className="group bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900 text-lg">
                                {item.data.description}
                              </h3>
                            </div>
                            <p className="text-green-700 text-sm mb-2">
                              {item.data.project || ''}
                            </p>
                            <div className="flex items-center space-x-4 text-green-600">
                              {!isToday() && (
                                <>
                                  <span className="text-sm font-medium">
                                    {formatInTimezone(currentTimeRef.current, 'MMMM d')}
                                  </span>
                                </>
                              )}
                              <span className="text-sm">
                                {formatInTimezone(parseISO(item.data.startTime), 'h:mm a')} - now
                              </span>
                              <span className="font-mono font-semibold">
                                {getActiveDuration(item.data)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={handleStop}
                                className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg flex items-center space-x-2"
                                aria-label="Pause timer"
                              >
                                <Pause className="w-4 h-4" />
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
                    </motion.div>
                  );
                } else if (item.type === 'break') {
                  // Validate break item has required data and breakKey
                  if (!item.data || !item.breakKey) {
                    error('Invalid break entry detected - missing required data');
                  }

                  return (
                    <motion.div
                      key={item.breakKey}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="text-center py-2"
                    >
                      <div
                        className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm"
                      >
                        <span className="font-medium">Break</span>
                        <span>•</span>
                        <span>{formatBreakDuration(item.data)}</span>
                      </div>
                    </motion.div>
                  );
                } else {
                  // Entry type
                  const entry = item.data;
                  
                  // Validate entry has required data and ID
                  if (!entry || !entry.id) {
                    error('Invalid time entry detected - missing required data');
                  }

                  const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
                  const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
                  const duration = differenceInSeconds(endTimeInTimezone, startTimeInTimezone);

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: 0 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      layout
                    >
                      <div className="group bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-all">
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
                              disabled={pomodoroIsRunning}
                              className={`p-3 rounded-full flex items-center space-x-1 transition-colors ${
                                pomodoroIsRunning
                                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                              title={pomodoroIsRunning ? 'Cannot continue timer while Pomodoro is active' : ''}
                              aria-label={pomodoroIsRunning ? 'Cannot continue timer while Pomodoro is active' : `Continue task: ${entry.description}`}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenModal('edit', entry)}
                              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg flex items-center space-x-1"
                              aria-label={`Edit task: ${entry.description}`}
                            >
                              <Edit className="w-4 h-4" />
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
                    </motion.div>
                  );
                }
            })}

          </AnimatePresence>
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
