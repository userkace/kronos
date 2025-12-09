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

  // Helper function to clean up duplicate entries caused by timezone conversion bugs
  const cleanupDuplicateEntries = () => {
    const allData = loadTimesheetData();
    const cleanedData = {};
    const seenIds = new Set();
    
    Object.keys(allData).forEach(dateKey => {
      const entries = allData[dateKey];
      const validEntries = [];
      
      entries.forEach(entry => {
        // Skip if we've already seen this ID
        if (seenIds.has(entry.id)) {
          console.log(`Skipping duplicate entry ${entry.id} from ${dateKey}`);
          return;
        }
        
        seenIds.add(entry.id);
        
        // Calculate the correct date key for this entry based on its start time
        if (entry.startTime) {
          const entryDateInTimezone = toZonedTime(parseISO(entry.startTime), timezone);
          const correctDateKey = format(entryDateInTimezone, 'yyyy-MM-dd');
          
          // If the entry is in the wrong date key, move it
          if (correctDateKey !== dateKey) {
            console.log(`Moving entry ${entry.id} from ${dateKey} to ${correctDateKey}`);
            if (!cleanedData[correctDateKey]) {
              cleanedData[correctDateKey] = [];
            }
            cleanedData[correctDateKey].push(entry);
          } else {
            // Entry is in the correct place
            if (!cleanedData[dateKey]) {
              cleanedData[dateKey] = [];
            }
            cleanedData[dateKey].push(entry);
          }
        } else {
          // No start time, keep as is
          if (!cleanedData[dateKey]) {
            cleanedData[dateKey] = [];
          }
          cleanedData[dateKey].push(entry);
        }
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
        const active = dayEntries.find(entry => entry.isActive);
        if (active) {
          console.log('Setting activeEntry from data:', active);
          setActiveEntry(active);
        } else if (activeEntry) {
          console.log('Keeping existing activeEntry:', activeEntry);
          // Keep existing activeEntry if no active found in today's entries
          // This handles the case where we navigated away and back
        } else {
          // Look for active entry in all dates (for timers that might be stored under wrong date)
          let foundActive = null;
          Object.keys(loadedData).forEach(dateKey => {
            const entries = loadedData[dateKey];
            const activeInDate = entries.find(entry => entry.isActive);
            if (activeInDate) {
              foundActive = activeInDate;
              console.log('Found active entry in different date key:', dateKey, activeInDate);
            }
          });
          
          if (foundActive) {
            console.log('Setting activeEntry from different date:', foundActive);
            setActiveEntry(foundActive);
          } else {
            console.log('No activeEntry found anywhere');
            setActiveEntry(null);
          }
        }
      } else {
        // Don't clear activeEntry when viewing other dates - keep the timer running
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
  }, [timezone, selectedDateEntries, activeEntry, isTimezoneInitialized]); // Re-create timer when dependencies change or timezone initializes

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

    // Only update selectedDateEntries if we're viewing today
    if (isToday()) {
      setSelectedDateEntries(updatedEntries);
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
    // Only update selectedDateEntries if we're viewing today
    if (isToday()) {
      const sortedEntries = [...allData[storageKey]].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setSelectedDateEntries(sortedEntries);
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
      setSelectedDateEntries(sortedEntries);
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
    const updatedEntries = selectedDateEntries.filter(e => e.id !== entry.id);
    setSelectedDateEntries(updatedEntries);
    handleCloseModal();
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

    const earliestStart = new Date(Math.min(...startTimes));
    const latestEnd = new Date(Math.max(...endTimes));

    // Calculate total work hours and break hours in selected timezone
    const totalWorkMinutes = completedEntries.reduce((total, entry) => {
      const start = toZonedTime(parseISO(entry.startTime), timezone);
      const end = toZonedTime(parseISO(entry.endTime), timezone);
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 text-center">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {isToday() ? 'Today' : formatInTimezone(selectedDate, 'EEEE')}, {formatInTimezone(selectedDate, 'MMM d, yyyy')}
                  </h1>
                </div>

                <div className="flex items-center space-x-2 justify-end">
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
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
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
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleOpenModal('add')}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
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
                    {!isToday() && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        From Today
                      </span>
                    )}
                  </div>
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
            const completedEntries = selectedDateEntries.filter(entry => !entry.isActive);
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
      />
    </div>
  );
};

export default DailyTracker;
