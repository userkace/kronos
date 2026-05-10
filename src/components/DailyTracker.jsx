import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInSeconds, parseISO, parse, addDays, subDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Play, Pause, Square, Plus, Clock, Edit, ChevronLeft, ChevronRight, Merge, ArrowUp, ArrowDown, Calendar, Coffee } from 'lucide-react';
import DatePicker from './molecules/DatePicker';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import TimezoneSelect from './TimezoneSelect';
import TimeEntryModal from './TimeEntryModal';
import { useToast } from '../contexts/ToastContext';
import { insertActiveEntryChronologically, generateEntryId } from '../utils/entryUtils';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useUnifiedDisplay } from '../hooks/useUnifiedDisplay';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
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
import { writeWeeklyTimesheetForDates } from '../utils/weeklyTimesheet';

// Hoisted to module scope so the array isn't reallocated on every render of
// DailyTracker. Frozen because we never want to mutate it.
const FUNNY_DEFAULT_TASKS = Object.freeze([
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
]);

const DailyTracker = ({ timezone, timezoneInitialized = false, onTimezoneChange, onWeeklyTimesheetSave = () => {} }) => {
  const { success, error, warning, actionToast } = useToast();
  const { isRunning: pomodoroIsRunning } = usePomodoro();
  const { getTransition, animations } = useMotionPreferences();

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
    toggleShowBreaks,
    dailyHourGoal
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

  // Inline-edit state. When non-null, the entry's `field` is rendered as an
  // input. Save happens on Enter or blur; Esc cancels without writing. Only
  // one cell is edited at a time.
  // Shape: { entryId: string, field: 'description' | 'startTime' | 'endTime', value: string }
  const [inlineEdit, setInlineEdit] = useState(null);

  // Check if timezone is properly initialized. Use the explicit flag from
  // TimezoneContext rather than a value-based sentinel — comparing against
  // 'UTC' would lock out users who legitimately picked UTC as their zone.
  const isTimezoneInitialized = timezoneInitialized && Boolean(timezone);

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

  // Helper function to clean up duplicate entries caused by timezone conversion bugs.
  // Returns null when nothing was duplicated (so storage-event-triggered calls
  // don't write needlessly, and don't risk an infinite event loop).
  const cleanupDuplicateEntries = () => {
    const allData = loadTimesheetData();

    // Pass 1: detect. If there are no duplicates we can early-return without
    // touching storage at all.
    const seenIds = new Set();
    let hadDuplicates = false;
    outer: for (const dateKey of Object.keys(allData)) {
      for (const entry of allData[dateKey] || []) {
        if (seenIds.has(entry.id)) {
          hadDuplicates = true;
          break outer;
        }
        seenIds.add(entry.id);
      }
    }
    if (!hadDuplicates) return null;

    // Pass 2: dedupe. Keep entries in their original date keys so we don't
    // recalculate dates based on timezone (which would move entries around).
    const cleanedData = {};
    const seenIds2 = new Set();
    Object.keys(allData).forEach(dateKey => {
      (allData[dateKey] || []).forEach(entry => {
        if (seenIds2.has(entry.id)) return;
        seenIds2.add(entry.id);
        if (!cleanedData[dateKey]) cleanedData[dateKey] = [];
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

  // Load data from localStorage on mount and when date changes
  useEffect(() => {
    const loadData = () => {
      // Dedupe before reading. Previously this only ran on mount, which
      // meant duplicates introduced via mid-session import sat around until
      // the next reload. cleanupDuplicateEntries early-returns when there's
      // nothing to do, so storage-event-triggered calls don't write or loop.
      cleanupDuplicateEntries();

      const loadedData = loadTimesheetData() || {};
      const storageKey = getStorageDateKey(selectedDate);

      // Display entries for the viewed day.
      const dayEntries = loadedData[storageKey] || [];
      const sortedEntries = [...dayEntries].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );
      setSelectedDateEntries(sortedEntries);

      // Enforce the global single-active invariant: scan EVERY date for an
      // isActive entry. If only the previously-viewed date is checked (the
      // old behavior), an active timer running on day A becomes invisible
      // when the user views day B, so handleStart on a fresh navigation can
      // create a second active entry without closing the first.
      const activeEntries = [];
      Object.keys(loadedData).forEach(dateKey => {
        (loadedData[dateKey] || []).forEach(entry => {
          if (entry.isActive) {
            activeEntries.push({ entry, dateKey });
          }
        });
      });

      if (activeEntries.length === 0) {
        setActiveEntry(null);
        return;
      }

      // Newest first.
      activeEntries.sort(
        (a, b) => new Date(b.entry.startTime) - new Date(a.entry.startTime)
      );

      if (activeEntries.length > 1) {
        // Multiple actives shouldn't exist; close the older ones. Cap recorded
        // duration at 8h since anything beyond that is almost certainly a
        // forgot-to-stop timer rather than real work.
        const MAX_RECOVERED_SECONDS = 8 * 60 * 60;
        const nowMs = Date.now();
        let mutated = false;
        for (let i = 1; i < activeEntries.length; i++) {
          const { entry, dateKey } = activeEntries[i];
          const startMs = parseISO(entry.startTime).getTime();
          const cappedEndMs = Math.min(nowMs, startMs + MAX_RECOVERED_SECONDS * 1000);
          const idx = (loadedData[dateKey] || []).findIndex(e => e.id === entry.id);
          if (idx >= 0) {
            loadedData[dateKey][idx] = {
              ...entry,
              isActive: false,
              endTime: new Date(cappedEndMs).toISOString(),
            };
            mutated = true;
          }
        }
        if (mutated) {
          saveTimesheetData(loadedData);
          warning(
            `Found ${activeEntries.length} active timers; kept the newest and closed the rest`
          );
        }
      }

      setActiveEntry(activeEntries[0].entry);
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

  // Format duration for display (h min format)
  const formatDisplayDuration = useCallback((seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }, []);

  // Calculate break time between two consecutive entries
  const calculateBreakTime = useCallback((currentEntry, previousEntry) => {
    if (!currentEntry || !previousEntry || !previousEntry.endTime || !currentEntry.startTime) return null;

    const prevEndInTimezone = toZonedTime(parseISO(previousEntry.endTime), timezone);
    const currentStartInTimezone = toZonedTime(parseISO(currentEntry.startTime), timezone);

    const breakSeconds = differenceInSeconds(currentStartInTimezone, prevEndInTimezone);

    // Handle negative break times which indicate data inconsistency
    if (breakSeconds < 0) {
      console.warn(
        `Data inconsistency detected: Negative break time (${breakSeconds}s) between entries. ` +
        `Previous entry (${previousEntry.id}) ends at ${previousEntry.endTime}, ` +
        `current entry (${currentEntry.id}) starts at ${currentEntry.startTime}. ` +
        `This may indicate overlapping times or out-of-order entries.`
      );
      return null;
    }

    // Only show breaks longer than 10 seconds to avoid noise
    if (breakSeconds <= 10) return null;

    return breakSeconds;
  }, [timezone]);

  // Calculate total break time for the day
  const dailyBreakTotal = useMemo(() => {
    let totalBreakSeconds = 0;

    // Get completed entries only (filter out active entries)
    const completedEntries = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);

    // Handle active entry by inserting it in correct chronological position using shared utility
    // selectedDateEntries are already sorted chronologically, so skip sorting for performance
    const chronologicalCompletedAndActive = insertActiveEntryChronologically(completedEntries, activeEntry, true);

    // Calculate break times between consecutive entries
    for (let i = 1; i < chronologicalCompletedAndActive.length; i++) {
      const currentEntry = chronologicalCompletedAndActive[i];
      const previousEntry = chronologicalCompletedAndActive[i - 1];

      // Only calculate break if previous entry has an end time and is not active
      // Also ensure neither current nor previous entry is the active entry
      if (previousEntry.endTime && !previousEntry.isActive && !currentEntry.isActive) {
        const breakTime = calculateBreakTime(currentEntry, previousEntry);
        if (breakTime) {
          totalBreakSeconds += breakTime;
        }
      }
    }

    return formatDisplayDuration(totalBreakSeconds);
  }, [selectedDateEntries, activeEntry, calculateBreakTime, formatDisplayDuration]);

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

  // Format break time with seconds always included
  const formatBreakDuration = (seconds) => {
    // Validate that seconds is a positive number
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return 'Invalid break time';
    }

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ${remainingSeconds}s` : `${hours}h ${remainingSeconds}s`;
  };

  // Total daily time as a raw number of seconds. Split out from
  // calculateDailyTotal so callers that need the numeric value (e.g. the
  // goal-met check that drives the gold-pulse animation) don't have to
  // re-parse the formatted string.
  const calculateDailyTotalSeconds = () => {
    let totalSeconds = 0;

    selectedDateEntries.forEach(entry => {
      if (!entry.isActive && entry.endTime) {
        const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
        const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
        totalSeconds += differenceInSeconds(endTimeInTimezone, startTimeInTimezone);
      }
    });

    if (activeEntry && isToday()) {
      const startTimeInTimezone = toZonedTime(parseISO(activeEntry.startTime), timezone);
      const currentTimeInTimezone = toZonedTime(currentTimeRef.current, timezone);
      totalSeconds += differenceInSeconds(currentTimeInTimezone, startTimeInTimezone);
    }

    return totalSeconds;
  };

  const calculateDailyTotal = () => formatDisplayDuration(calculateDailyTotalSeconds());

  // Start new timer (only works on current date)
  const handleStart = () => {
    // Prevent starting if Pomodoro is running
    if (pomodoroIsRunning) {
      warning('Cannot start timer while Pomodoro is active');
      return;
    }

    const taskToStart = currentTask.trim() || FUNNY_DEFAULT_TASKS[Math.floor(Math.random() * FUNNY_DEFAULT_TASKS.length)];

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
      id: generateEntryId(),
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
    // Clear input ready for the next task
    setCurrentTask('');
  };

  // Stop active timer
  const handleStop = () => {
    if (!activeEntry) return;

    const now = new Date();
    const utcTime = now;
    const currentTimeInTimezone = toZonedTime(now, timezone);

    const timerStartDate = format(toZonedTime(parseISO(activeEntry.startTime), timezone), 'yyyy-MM-dd');
    const currentDateInTimezone = format(currentTimeInTimezone, 'yyyy-MM-dd');
    const storageKey = getStorageDateKey(timerStartDate);

    // Build the ordered list of yyyy-MM-dd keys spanned by this timer, inclusive.
    const datesInRange = [];
    let cursor = parse(timerStartDate, 'yyyy-MM-dd', new Date());
    const endCursor = parse(currentDateInTimezone, 'yyyy-MM-dd', new Date());
    while (cursor <= endCursor) {
      datesInRange.push(format(cursor, 'yyyy-MM-dd'));
      cursor = addDays(cursor, 1);
    }

    // A timer running for many days is almost always a forgot-to-stop mistake.
    // Recording it would invent full days of work, so confirm before proceeding.
    const MAX_ROLLOVER_DAYS = 7;
    if (datesInRange.length > MAX_ROLLOVER_DAYS) {
      const proceed = window.confirm(
        `This timer has been running for ${datesInRange.length} days. ` +
        `Recording it will create a full-day entry for each intermediate day. Continue?`
      );
      if (!proceed) return;
    }

    // Convert a wall-clock boundary on a given day into a UTC instant.
    // The optional msOffset lets us hit the very-end-of-day boundary
    // (23:59:59.999) so an end-of-day segment touches the next day's
    // 00:00:00.000 with no gap. Without this, every midnight crossing
    // would lose one second of tracked time.
    const buildBoundaryUTC = (dateString, timeString, msOffset = 0) => {
      const baseDate = parse(dateString, 'yyyy-MM-dd', new Date());
      const wallTime = parse(timeString, 'HH:mm:ss', baseDate);
      const adjusted = msOffset
        ? new Date(wallTime.getTime() + msOffset)
        : wallTime;
      return fromZonedTime(adjusted, timezone);
    };

    const isMultiDay = datesInRange.length > 1;
    const allData = loadTimesheetData() || {};
    if (!allData[storageKey]) allData[storageKey] = [];

    // Close the original entry: end at now if same day, else end at the very
    // end of its start day so the next day's 00:00:00 segment is contiguous.
    const stopTime = isMultiDay
      ? buildBoundaryUTC(timerStartDate, '23:59:59', 999)
      : utcTime;

    const updatedEntry = {
      ...activeEntry,
      endTime: stopTime.toISOString(),
      isActive: false
    };

    // The active entry can disappear from storage between the time we loaded it
    // into local state and now (deleted in another tab, dropped during import,
    // etc.). If we just .map over the array, no replacement happens and the
    // tracked time silently vanishes. Recover by pushing the entry instead.
    const entryExistsInStorage = allData[storageKey].some(
      entry => entry.id === activeEntry.id
    );
    if (entryExistsInStorage) {
      allData[storageKey] = allData[storageKey].map(entry =>
        entry.id === activeEntry.id ? updatedEntry : entry
      );
    } else {
      allData[storageKey].push(updatedEntry);
      warning('Active timer was missing from storage; restoring your tracked time');
    }

    // For every day after the start day, emit a segment.
    // Intermediate days span the full day; the last day ends at "now".
    if (isMultiDay) {
      for (let i = 1; i < datesInRange.length; i++) {
        const dateString = datesInRange[i];
        const isLastDay = i === datesInRange.length - 1;
        const segStart = buildBoundaryUTC(dateString, '00:00:00');
        const segEnd = isLastDay ? utcTime : buildBoundaryUTC(dateString, '23:59:59', 999);

        const segmentEntry = {
          id: generateEntryId(),
          description: activeEntry.description,
          project: activeEntry.project,
          task: activeEntry.task,
          tags: activeEntry.tags,
          startTime: segStart.toISOString(),
          endTime: segEnd.toISOString(),
          isActive: false
        };

        const segKey = getStorageDateKey(dateString);
        if (!allData[segKey]) allData[segKey] = [];
        allData[segKey].push(segmentEntry);
      }
    }

    saveTimesheetData(allData);

    // Refresh the displayed day if it was touched.
    const selectedDateKey = getStorageDateKey(selectedDate);
    if (allData[selectedDateKey]) {
      const sorted = [...allData[selectedDateKey]].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );
      setSelectedDateEntries(sorted);
    }

    setActiveEntry(null);

    if (isMultiDay) {
      const firstFmt = formatInTimezone(parse(timerStartDate, 'yyyy-MM-dd', new Date()), 'MMM. d');
      const lastFmt = formatInTimezone(parse(currentDateInTimezone, 'yyyy-MM-dd', new Date()), 'MMM. d');
      success(
        datesInRange.length === 2
          ? `Task time recorded for ${firstFmt} and ${lastFmt}`
          : `Task time recorded across ${datesInRange.length} days (${firstFmt} – ${lastFmt})`
      );
    }

    // Auto-save weekly rows for every affected date, not just two.
    setTimeout(() => {
      autoSaveToWeeklyTimesheet(datesInRange);
    }, 100);
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
      id: generateEntryId(),
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
    const storageKey = getStorageDateKey(selectedDate);
    const allData = loadTimesheetData() || {};
    const entries = allData[storageKey] || [];

    // Find all entries with the same description
    const entriesToMerge = entries.filter(entry => entry.description === description);

    if (entriesToMerge.length < 2) {
      warning('Need at least 2 entries to merge');
      return;
    }

    // Snapshot the day's entries before mutating so Undo can restore them.
    // Deep-cloned to insulate from any subsequent in-place mutations.
    const dayBeforeSnapshot = JSON.parse(JSON.stringify(entries));

    // Calculate the earliest start time and latest end time
    const startTimes = entriesToMerge.map(entry => parseISO(entry.startTime));
    const endTimes = entriesToMerge.map(entry => entry.endTime ? parseISO(entry.endTime) : new Date());

    const earliestStart = new Date(Math.min(...startTimes));
    const latestEnd = new Date(Math.max(...endTimes));

    // Create merged entry
    const mergedEntry = {
      id: generateEntryId(),
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

    autoSaveToWeeklyTimesheet([storageKey]);

    actionToast(
      `Merged ${entriesToMerge.length} entries into "${description}"`,
      {
        label: 'Undo',
        onClick: () => {
          const data = loadTimesheetData() || {};
          data[storageKey] = dayBeforeSnapshot;
          saveTimesheetData(data);
          setSelectedDateEntries(dayBeforeSnapshot);
          autoSaveToWeeklyTimesheet([storageKey]);
          success('Merge undone');
        },
      }
    );
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
      let localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));
      // For overnight shifts, the end time is on the next calendar day.
      if (entryData.isOvernight) localEndDateTime = addDays(localEndDateTime, 1);

      // Convert from selected timezone to UTC
      startDateTime = fromZonedTime(localStartDateTime, timezone);
      endDateTime = fromZonedTime(localEndDateTime, timezone);
    } else {
      // When using custom timezone, create date object and convert from that timezone
      const localStartDateTime = parse(entryData.startTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));
      let localEndDateTime = parse(entryData.endTime, 'HH:mm:ss', parse(entryDate, 'yyyy-MM-dd', new Date()));
      if (entryData.isOvernight) localEndDateTime = addDays(localEndDateTime, 1);

      // Convert from custom timezone to UTC
      startDateTime = toZonedTime(localStartDateTime, timezoneToUse);
      endDateTime = toZonedTime(localEndDateTime, timezoneToUse);
    }

    const newEntry = {
      id: modalState.mode === 'edit' ? modalState.initialData.id : generateEntryId(),
      ...entryData,
      isActive: false,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString()
    };

    // Remove date field from entry to match timer format
    delete newEntry.date;
    // isOvernight is a UI-layer concern — the persisted entry already encodes
    // the next-day end via its ISO endTime, so don't pollute storage with it.
    delete newEntry.isOvernight;

    // Get the storage key for the selected date
    const entryStorageKey = getStorageDateKey(entryDate);
    const currentStorageKey = getStorageDateKey(selectedDate); // Use selected date for display

    // Load all existing data
    const allData = loadTimesheetData() || {};

    // Initialize the entry's date array if it doesn't exist
    if (!allData[entryStorageKey]) {
      allData[entryStorageKey] = [];
    }

    // Track dates affected by this save so we can sync the weekly timesheet.
    const affectedDates = [entryStorageKey];

    // Handle edit vs add
    if (modalState.mode === 'edit') {
      // For editing, we need to find the original entry's date from startTime
      const originalDate = format(toZonedTime(parseISO(modalState.initialData.startTime), timezone), 'yyyy-MM-dd');
      const oldStorageKey = getStorageDateKey(originalDate);

      // If editing and the date changed, remove from old date
      if (oldStorageKey !== entryStorageKey) {
        if (allData[oldStorageKey]) {
          allData[oldStorageKey] = allData[oldStorageKey].filter(entry => entry.id !== modalState.initialData.id);
          if (allData[oldStorageKey].length === 0) {
            delete allData[oldStorageKey];
          }
        }
        affectedDates.push(oldStorageKey);
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

    autoSaveToWeeklyTimesheet(affectedDates);
  };

  // Set when Esc is pressed in an inline editor — tells commitInlineEdit
  // (which also runs from onBlur) to skip writing for that one trigger.
  const skipNextBlurCommitRef = useRef(false);

  const startInlineEdit = (entry, field, dims = null) => {
    if (!entry || !field) return;
    // Active entries can't have their times inline-edited (no endTime, and
    // mutating startTime mid-run is a footgun handled better by the modal).
    if ((field === 'startTime' || field === 'endTime') && (entry.isActive || !entry.endTime)) return;

    let initialValue = '';
    if (field === 'description') {
      initialValue = entry.description || '';
    } else if (field === 'startTime') {
      initialValue = formatInTimezone(parseISO(entry.startTime), 'HH:mm:ss');
    } else if (field === 'endTime') {
      initialValue = formatInTimezone(parseISO(entry.endTime), 'HH:mm:ss');
    }
    setInlineEdit({ entryId: entry.id, field, value: initialValue, dims });
  };

  const updateInlineValue = (value) => {
    setInlineEdit(prev => prev ? { ...prev, value } : prev);
  };

  const cancelInlineEdit = () => {
    skipNextBlurCommitRef.current = true;
    setInlineEdit(null);
  };

  const commitInlineEdit = () => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
      return;
    }
    if (!inlineEdit) return;
    const editing = inlineEdit;
    setInlineEdit(null);

    const entry = selectedDateEntries.find(e => e.id === editing.entryId);
    if (!entry) return;

    let updated = null;

    if (editing.field === 'description') {
      const trimmed = (editing.value || '').trim();
      if (!trimmed) {
        warning('Task name cannot be empty');
        return;
      }
      if (trimmed === (entry.description || '').trim()) return;
      updated = { ...entry, description: trimmed };
    } else if (editing.field === 'startTime' || editing.field === 'endTime') {
      const v = (editing.value || '').trim();
      // Accept HH:mm or HH:mm:ss — browsers may strip seconds on some <input
      // type="time"> implementations even when step="1" is set, so seconds
      // are optional on input. They're always emitted on save.
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) {
        warning('Invalid time');
        return;
      }
      const parts = v.split(':').map(Number);
      const [h, m] = parts;
      const s = Number.isFinite(parts[2]) ? parts[2] : 0;
      if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
        warning('Invalid time');
        return;
      }

      // Preserve the original calendar day in the user's timezone — keeps
      // overnight entries (where the end falls on day+1) from collapsing
      // back to a single day when only the time-of-day is changed.
      const isoToEdit = editing.field === 'startTime' ? entry.startTime : entry.endTime;
      if (!isoToEdit) return;
      const zonedOriginal = toZonedTime(parseISO(isoToEdit), timezone);
      zonedOriginal.setHours(h, m, s, 0);
      const newIso = fromZonedTime(zonedOriginal, timezone).toISOString();

      const newStartIso = editing.field === 'startTime' ? newIso : entry.startTime;
      const newEndIso = editing.field === 'endTime' ? newIso : entry.endTime;
      if (newEndIso && parseISO(newStartIso).getTime() >= parseISO(newEndIso).getTime()) {
        warning('End must be after start. Use the Edit button for overnight entries.');
        return;
      }

      updated = { ...entry };
      if (editing.field === 'startTime') updated.startTime = newIso;
      else updated.endTime = newIso;
    }

    if (!updated) return;

    // Use the entry's startTime to derive the storage key so an entry whose
    // start day doesn't match `selectedDate` (rare, but possible across
    // timezone changes) still writes to the right bucket.
    const entryDateStr = format(toZonedTime(parseISO(entry.startTime), timezone), 'yyyy-MM-dd');
    const storageKey = entryDateStr;
    const allData = loadTimesheetData() || {};
    const dayEntries = allData[storageKey] || [];
    const idx = dayEntries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      dayEntries[idx] = updated;
      dayEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      allData[storageKey] = dayEntries;
      saveTimesheetData(allData);
    }

    setSelectedDateEntries(prev => {
      const next = prev.map(e => e.id === entry.id ? updated : e);
      return next.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    });

    autoSaveToWeeklyTimesheet([storageKey]);
  };

  // Remove from localStorage
  const handleDeleteEntry = (entry) => {
    // Use startTime to determine the storage key instead of date field
    const entryDate = format(toZonedTime(parseISO(entry.startTime), timezone), 'yyyy-MM-dd');
    const storageKey = getStorageDateKey(entryDate);
    const allData = loadTimesheetData() || {};
    // Snapshot the day's entries so Undo can restore them verbatim. Deep-cloned
    // to insulate from any in-place mutations elsewhere.
    const dayBeforeSnapshot = JSON.parse(JSON.stringify(allData[storageKey] || []));
    const wasOnSelectedDate = storageKey === getStorageDateKey(selectedDate);

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

    autoSaveToWeeklyTimesheet([storageKey]);

    actionToast(
      `Deleted "${entry.description || 'entry'}"`,
      {
        label: 'Undo',
        onClick: () => {
          const data = loadTimesheetData() || {};
          data[storageKey] = dayBeforeSnapshot;
          saveTimesheetData(data);
          if (wasOnSelectedDate) setSelectedDateEntries(dayBeforeSnapshot);
          autoSaveToWeeklyTimesheet([storageKey]);
          success('Restored');
        },
      }
    );
  };

  // Merge overlapping time periods to calculate accurate total work time
  const mergeOverlappingPeriods = (entries) => {
    if (entries.length === 0) return [];

    // Full-precision periods in the selected timezone. Previously this
    // floored each entry to the minute via setSeconds(0, 0), which drifted
    // the daily total by minutes on busy days.
    const periods = entries.map(entry => ({
      start: toZonedTime(parseISO(entry.startTime), timezone),
      end: toZonedTime(parseISO(entry.endTime), timezone),
    }));

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
    // if (activeEntry) {
    //   warning('Please stop the active task before saving to weekly timesheet');
    //   return;
    // }

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

    // Compute in seconds; format with seconds at the display boundary so the
    // weekly row reflects full precision (matches weeklyTimesheet.js).
    const mergedPeriods = mergeOverlappingPeriods(completedEntries);

    const totalWorkSeconds = mergedPeriods.reduce((total, period) => {
      return total + differenceInSeconds(period.end, period.start);
    }, 0);

    const totalWorkHours = totalWorkSeconds / 3600;
    const timeSpanSeconds = differenceInSeconds(latestEnd, earliestStart);
    const breakHoursDecimal = Math.max(0, (timeSpanSeconds - totalWorkSeconds) / 3600);

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
      timeIn: format(earliestStart, 'HH:mm:ss'),
      timeOut: format(latestEnd, 'HH:mm:ss'),
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

  // Recompute the weekly timesheet for the given dates and surface a toast.
  // Used by every mutation path (timer stop, manual add/edit, delete, merge)
  // so the weekly view stays in sync without requiring an explicit save.
  const autoSaveToWeeklyTimesheet = (targetDates) => {
    if (!Array.isArray(targetDates) || targetDates.length === 0) return;

    const { saved, cleared, errors } = writeWeeklyTimesheetForDates(
      targetDates,
      timezone
    );

    if (saved.length === 1) {
      const r = saved[0];
      success(
        `Auto-saved to weekly timesheet: ${r.completedCount} task(s) for ${formatInTimezone(r.dateObj, 'MMM. d, yyyy')}`
      );
    } else if (saved.length > 1) {
      const parts = saved.map(
        r => `${r.completedCount} task(s) for ${formatInTimezone(r.dateObj, 'MMM. d')}`
      );
      success(`Auto-saved to weekly timesheet: ${parts.join(' & ')}`);
    }

    if (cleared.length === 1) {
      success(
        `Cleared weekly timesheet entry for ${formatInTimezone(cleared[0].dateObj, 'MMM. d, yyyy')}`
      );
    } else if (cleared.length > 1) {
      const parts = cleared.map(c => formatInTimezone(c.dateObj, 'MMM. d'));
      success(`Cleared weekly timesheet entries for ${parts.join(' & ')}`);
    }

    errors.forEach(({ dateString }) => {
      const dateObj = parse(dateString, 'yyyy-MM-dd', new Date());
      warning(
        `Failed to auto-save weekly timesheet for ${formatInTimezone(dateObj, 'MMM. d, yyyy')}`
      );
    });

    if (saved.length > 0 || cleared.length > 0) {
      try {
        if (onWeeklyTimesheetSave) onWeeklyTimesheetSave();
      } catch (err) {
        console.error('Error triggering weekly timesheet refresh:', err);
      }
    }
  };

  // Validate unified display items and collect errors
  const validateUnifiedDisplay = useCallback((items) => {
    const errors = [];

    items.forEach((item, index) => {
      if (!item || !item.type) {
        errors.push(`Invalid entry detected at position ${index + 1}`);
        return;
      }

      if (item.type === 'active') {
        if (item.data === null || item.data === undefined || !item.data.id) {
          errors.push(`Invalid active entry detected - missing required data`);
        }
      } else if (item.type === 'break') {
        if (!item.breakKey) {
          errors.push(`Invalid break entry detected - missing required data`);
        } else if (typeof item.data !== 'number' || isNaN(item.data) || item.data < 0) {
          errors.push(`Invalid break entry detected - break time must be a positive number`);
        }
      } else if (item.type === 'entry') {
        const entry = item.data;
        if (!entry || !entry.id) {
          errors.push(`Invalid time entry detected - missing required data`);
        } else if (!entry.startTime || (!entry.endTime && !entry.isActive)) {
          errors.push(`Invalid time entry detected - missing startTime or endTime`);
        }
      } else {
        errors.push(`Invalid entry type detected at position ${index + 1}: ${item.type}`);
      }
    });

    return errors;
  }, []);

  // Memoized unified display computation for entries and breaks
  const unifiedDisplay = useUnifiedDisplay(
    activeEntry,
    selectedDateEntries,
    sortOrder,
    showBreaks,
    calculateBreakTime
  );

  // Track previously shown errors to prevent repeated toast messages
  const [previousErrors, setPreviousErrors] = useState(new Set());

  // Show consolidated error message when invalid entries are detected
  useEffect(() => {
    const errors = validateUnifiedDisplay(unifiedDisplay);
    if (errors.length > 0) {
      const errorString = errors.join('; ');
      const errorHash = btoa(errorString); // Create a hash of the error string

      // Only show error if it's different from previously shown errors
      if (!previousErrors.has(errorHash)) {
        error(`Data validation errors detected: ${errorString}`);
        setPreviousErrors(prev => new Set([...prev, errorHash]));
      }
    } else {
      // Clear previous errors when there are no current errors
      setPreviousErrors(new Set());
    }
  }, [unifiedDisplay, validateUnifiedDisplay, error]);

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

          {(() => {
            const dailyTotalSeconds = calculateDailyTotalSeconds();
            const goalSeconds = (Number.isFinite(dailyHourGoal) && dailyHourGoal > 0)
              ? dailyHourGoal * 3600
              : 0;
            const goalMet = goalSeconds > 0 && dailyTotalSeconds >= goalSeconds;
            return (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-baseline space-x-2 text-gray-600">
                {goalMet ? (
                <motion.div
                  className="flex items-baseline space-x-2"
                  animate={{
                    // amber-600 ↔ amber-300 — same pulse cadence as the active
                    // green shine, swapped to a gold palette for goal-hit.
                    color: ["#d97706", "#fcd34d", "#d97706"],
                    textShadow: [
                      "0 0 0px rgba(251, 191, 36, 0)",
                      "0 0 12px rgba(251, 191, 36, 0.55)",
                      "0 0 0px rgba(251, 191, 36, 0)"
                    ]
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  title={`Daily goal of ${dailyHourGoal}h reached`}
                >
                  <Clock className="w-5 h-5 self-center mt-1" />
                  <span className="text-2xl font-semibold">
                    {calculateDailyTotal()}
                  </span>
                </motion.div>
              ) : activeEntry && isToday() ? (
                <motion.div
                  className="flex items-baseline space-x-2"
                  animate={{
                    color: ["#16a34a", "#000000", "#16a34a"] // green-600 to black to green-600
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Clock className="w-5 h-5 self-center mt-1" />
                  <span className="text-2xl font-semibold">
                    {calculateDailyTotal()}
                  </span>
                </motion.div>
              ) : (
                <div className="flex items-baseline space-x-2 text-gray-600">
                  <Clock className="w-5 h-5 self-center mt-1" />
                  <span className="text-2xl font-semibold text-gray-900">
                    {calculateDailyTotal()}
                  </span>
                </div>
              )}
              </div>
              <AnimatePresence>
                {showBreaks && dailyBreakTotal !== '0s' && (
                  <motion.span
                    key="break-total"
                    initial={animations.scale.initial}
                    animate={animations.scale.animate}
                    exit={animations.scale.exit}
                    transition={getTransition({ duration: 0.3, ease: "easeInOut" })}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-600"
                  >
                    <Coffee className="w-4 h-4 mr-2" />
                    {dailyBreakTotal}
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
            );
          })()}
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
            {unifiedDisplay.map((item) => {
                if (item.type === 'active') {

                  return (
                    <motion.div
                      key={`active-${item.data.id}`}
                      initial={animations.slide.initial}
                      animate={animations.slide.animate}
                      exit={animations.slide.exit}
                      transition={getTransition({ duration: 0.3, ease: "easeOut" })}
                      layoutId={`entry-${item.data.id}`}
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

                  return (
                    <motion.div
                      key={item.breakKey}
                      layoutId={`break-${item.breakKey}`}
                      initial={animations.scale.initial}
                      animate={animations.scale.animate}
                      exit={animations.scale.exit}
                      transition={getTransition({ duration: 0.4, ease: "easeOut" })}
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
                } else if (item.type === 'entry') {
                  // Entry type (default case)
                  const entry = item.data;

                  const startTimeInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
                  const endTimeInTimezone = toZonedTime(parseISO(entry.endTime), timezone);
                  const duration = differenceInSeconds(endTimeInTimezone, startTimeInTimezone);

                  return (
                    <motion.div
                      key={entry.id}
                      initial={animations.fade.initial}
                      animate={animations.fade.animate}
                      exit={animations.fade.exit}
                      transition={getTransition({ duration: 0.3, ease: "easeOut" })}
                      layoutId={`entry-${entry.id}`}
                    >
                      <div className="group bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {inlineEdit?.entryId === entry.id && inlineEdit.field === 'description' ? (
                              <textarea
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => updateInlineValue(e.target.value)}
                                onBlur={commitInlineEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitInlineEdit(); }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
                                }}
                                onFocus={(e) => e.target.select()}
                                aria-label="Edit task name"
                                style={inlineEdit.dims ? {
                                  width: `${inlineEdit.dims.width}px`,
                                  height: `${inlineEdit.dims.height}px`,
                                } : undefined}
                                className="font-semibold text-gray-900 bg-blue-50 border border-blue-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-300 resize leading-snug box-border"
                              />
                            ) : (
                              <h3
                                className="font-semibold text-gray-900 cursor-text hover:bg-gray-100 rounded px-2 py-0.5 -mx-2 inline-block whitespace-pre-wrap wrap-break-word box-border"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  startInlineEdit(entry, 'description', {
                                    width: rect.width,
                                    height: rect.height,
                                  });
                                }}
                                title="Click to edit"
                              >
                                {entry.description}
                              </h3>
                            )}
                            <p className="text-gray-600 text-sm mb-2">
                              {entry.project || ''}
                            </p>
                            <div className="flex items-center space-x-4 text-gray-500">
                              <span className="text-sm flex items-center gap-1 flex-wrap">
                                {inlineEdit?.entryId === entry.id && inlineEdit.field === 'startTime' ? (
                                  <input
                                    type="time"
                                    step="1"
                                    autoFocus
                                    value={inlineEdit.value}
                                    onChange={(e) => updateInlineValue(e.target.value)}
                                    onBlur={commitInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                      else if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
                                    }}
                                    aria-label="Edit start time"
                                    className="text-sm border border-blue-300 bg-blue-50 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startInlineEdit(entry, 'startTime')}
                                    className="cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                    title="Click to edit"
                                  >
                                    {formatInTimezone(parseISO(entry.startTime), 'h:mm a')}
                                  </button>
                                )}
                                <span>-</span>
                                {inlineEdit?.entryId === entry.id && inlineEdit.field === 'endTime' ? (
                                  <input
                                    type="time"
                                    step="1"
                                    autoFocus
                                    value={inlineEdit.value}
                                    onChange={(e) => updateInlineValue(e.target.value)}
                                    onBlur={commitInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); commitInlineEdit(); }
                                      else if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
                                    }}
                                    aria-label="Edit end time"
                                    className="text-sm border border-blue-300 bg-blue-50 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startInlineEdit(entry, 'endTime')}
                                    className="cursor-text hover:bg-gray-100 rounded px-1 -mx-1"
                                    title="Click to edit"
                                  >
                                    {formatInTimezone(parseISO(entry.endTime), 'h:mm a')}
                                  </button>
                                )}
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
                              className={`p-3 rounded-full flex items-center space-x-1 ${
                                pomodoroIsRunning
                                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                              aria-label={`Continue task: ${entry.description}`}
                              title={pomodoroIsRunning ? 'Cannot continue while Pomodoro is active' : 'Continue this task'}
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
                } else {
                  // Fallback for unexpected item types
                  console.warn('Unexpected item type in unified display:', item.type, item);
                  return null;
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
              {isToday()
                ? "No time entries yet"
                : "No time entries for this date"
              }
            </h3>
            <p className="text-gray-400">
              {isToday()
                ? "Start tracking your time by entering a task above and clicking Start"
                : "Add manual time entries for this date using the Add Manual Entry button above"
              }
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
