// LocalStorage utility functions for the Time Tracking Application

const STORAGE_KEYS = {
  TIMESHEET_DATA: 'kronos_timesheet_data',
  SELECTED_TIMEZONE: 'kronos_selected_timezone',
  SELECTED_WEEK: 'kronos_selected_week',
  WEEKLY_TIMESHEET: 'kronos_weekly_timesheet',
  WEEK_START: 'kronos_week_start',
  ONBOARDING_COMPLETED: 'kronos_onboarding_completed',
  CLOCK_FORMAT: 'kronos_clock_format',
  SIDEBAR_STATE: 'kronos_sidebar_state',
  SORT_ORDER: 'kronos_sort_order',
  SHOW_BREAKS: 'kronos_show_breaks'
};

// Save timesheet data to LocalStorage
export const saveTimesheetData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TIMESHEET_DATA, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving timesheet data:', error);
  }
};

// Load timesheet data from LocalStorage
export const loadTimesheetData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TIMESHEET_DATA);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading timesheet data:', error);
    return {};
  }
};

// Save selected timezone to LocalStorage
export const saveTimezone = (timezone) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_TIMEZONE, timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
};

// Load selected timezone from LocalStorage
export const loadTimezone = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_TIMEZONE);
    return stored || null; // Return null instead of 'UTC' default
  } catch (error) {
    console.error('Error loading timezone:', error);
    return null;
  }
};

// Save selected week to LocalStorage
export const saveSelectedWeek = (date) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_WEEK, date.toISOString());
  } catch (error) {
    console.error('Error saving selected week:', error);
  }
};

// Load selected week from LocalStorage
export const loadSelectedWeek = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_WEEK);
    return stored ? new Date(stored) : new Date();
  } catch (error) {
    console.error('Error loading selected week:', error);
    return new Date();
  }
};

// Clear all application data from LocalStorage
export const clearAllData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};

// Save weekly timesheet data to LocalStorage
export const saveWeeklyTimesheet = (data) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_TIMESHEET, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving weekly timesheet data:', error);
  }
};

// Load weekly timesheet data from LocalStorage
export const loadWeeklyTimesheet = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_TIMESHEET);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading weekly timesheet data:', error);
    return {};
  }
};

// Save week start preference to LocalStorage
export const saveWeekStart = (weekStart) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WEEK_START, weekStart);
  } catch (error) {
    console.error('Error saving week start:', error);
  }
};

// Load week start preference from LocalStorage
export const loadWeekStart = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.WEEK_START) || 'sunday';
  } catch (error) {
    console.error('Error loading week start:', error);
    return 'sunday';
  }
};

// Save onboarding completion status to LocalStorage
export const saveOnboardingCompleted = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
  } catch (error) {
    console.error('Error saving onboarding status:', error);
  }
};

// Load onboarding completion status from LocalStorage
export const loadOnboardingCompleted = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED) === 'true';
  } catch (error) {
    console.error('Error loading onboarding status:', error);
    return false;
  }
};

// Save clock format preference to LocalStorage
export const saveClockFormat = (clockFormat) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CLOCK_FORMAT, clockFormat);
  } catch (error) {
    console.error('Error saving clock format:', error);
  }
};

// Load clock format preference from LocalStorage
export const loadClockFormat = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CLOCK_FORMAT) || '12hour'; // Default to 12-hour format
  } catch (error) {
    console.error('Error loading clock format:', error);
    return '12hour';
  }
};

// Save sidebar state to LocalStorage
export const saveSidebarState = (isOpen) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, JSON.stringify(isOpen));
  } catch (error) {
    console.error('Error saving sidebar state:', error);
  }
};

/**
 * Loads the sidebar state from LocalStorage
 * @returns {boolean} - Returns true if the sidebar should be open, false otherwise
 */
export const loadSidebarState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE);
    // Handle both old object format and new boolean format for backward compatibility
    if (saved) {
      const parsed = JSON.parse(saved);
      return typeof parsed === 'object' ? parsed.isOpen !== false : parsed !== false;
    }
    return true; // Default to open
  } catch (error) {
    console.error('Error loading sidebar state:', error);
    return true; // Default to open on error
  }
};

// Save sort order preference to LocalStorage
export const saveSortOrder = (sortOrder) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, JSON.stringify(sortOrder));
  } catch (error) {
    console.error('Error saving sort order:', error);
  }
};

// Load sort order preference from LocalStorage
export const loadSortOrder = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SORT_ORDER);
    return stored !== null ? JSON.parse(stored) : 'desc'; // Default to descending (newest first)
  } catch (error) {
    console.error('Error loading sort order:', error);
    return 'desc'; // Default to descending on error
  }
};

// Save break visibility preference to LocalStorage
export const saveShowBreaks = (showBreaks) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SHOW_BREAKS, JSON.stringify(showBreaks));
  } catch (error) {
    console.error('Error saving show breaks preference:', error);
  }
};

// Load break visibility preference from LocalStorage
export const loadShowBreaks = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SHOW_BREAKS);
    return stored !== null ? JSON.parse(stored) : true; // Default to true (show breaks)
  } catch (error) {
    console.error('Error loading show breaks preference:', error);
    return true; // Default to showing breaks on error
  }
};
