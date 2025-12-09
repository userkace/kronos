import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  addDays,
  differenceInSeconds,
  differenceInMinutes,
  parse,
  isValid
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Convert a UTC date to the selected timezone
 * @param {Date} utcDate - The UTC date to convert
 * @param {string} timezone - The target timezone (e.g., 'America/New_York')
 * @returns {Date} - The date in the target timezone
 */
export const utcToSelectedTimezone = (utcDate, timezone) => {
  return toZonedTime(utcDate, timezone);
};

/**
 * Convert a timezone-specific date to UTC
 * @param {Date} zonedDate - The date in the source timezone
 * @param {string} timezone - The source timezone
 * @returns {Date} - The UTC date
 */
export const selectedTimezoneToUtc = (zonedDate, timezone) => {
  return fromZonedTime(zonedDate, timezone);
};

/**
 * Format a date in the selected timezone
 * @param {Date} date - The date to format (can be UTC or local)
 * @param {string} formatStr - The format string
 * @param {string} timezone - The target timezone
 * @returns {string} - The formatted date string
 */
export const formatInTimezone = (date, formatStr, timezone) => {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr);
};

/**
 * Get the current date in the selected timezone
 * @param {string} timezone - The target timezone
 * @returns {Date} - The current date in the target timezone
 */
export const getCurrentDateInTimezone = (timezone) => {
  return toZonedTime(new Date(), timezone);
};

/**
 * Get the start of day in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @returns {Date} - The start of day in the target timezone
 */
export const getStartOfDayInTimezone = (date, timezone) => {
  const zonedDate = toZonedTime(date, timezone);
  return startOfDay(zonedDate);
};

/**
 * Get the end of day in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @returns {Date} - The end of day in the target timezone
 */
export const getEndOfDayInTimezone = (date, timezone) => {
  const zonedDate = toZonedTime(date, timezone);
  return endOfDay(zonedDate);
};

/**
 * Get the start of week in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @param {number} weekStartsOn - Day week starts on (0 = Sunday, 1 = Monday)
 * @returns {Date} - The start of week in the target timezone
 */
export const getStartOfWeekInTimezone = (date, timezone, weekStartsOn = 1) => {
  const zonedDate = toZonedTime(date, timezone);
  return startOfWeek(zonedDate, { weekStartsOn });
};

/**
 * Get the days of the week in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @param {number} weekStartsOn - Day week starts on (0 = Sunday, 1 = Monday)
 * @returns {Date[]} - Array of 7 days starting from the specified week start
 */
export const getWeekDaysInTimezone = (date, timezone, weekStartsOn = 1) => {
  const weekStart = getStartOfWeekInTimezone(date, timezone, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
};

/**
 * Parse a time string in the selected timezone
 * @param {string} timeString - The time string (e.g., '09:00')
 * @param {Date} date - The reference date
 * @param {string} timezone - The target timezone
 * @returns {Date} - The parsed date in UTC
 */
export const parseTimeInTimezone = (timeString, date, timezone) => {
  const zonedDate = toZonedTime(date, timezone);
  const parsed = parse(timeString, 'HH:mm', zonedDate);
  
  if (!isValid(parsed)) {
    throw new Error('Invalid time format');
  }
  
  return fromZonedTime(parsed, timezone);
};

/**
 * Format a time string in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @returns {string} - The formatted time string (e.g., '09:00 AM')
 */
export const formatTimeInTimezone = (date, timezone) => {
  return formatInTimezone(date, 'h:mm a', timezone);
};

/**
 * Calculate the duration between two dates in the selected timezone
 * @param {Date} startDate - The start date (can be UTC or local)
 * @param {Date} endDate - The end date (can be UTC or local)
 * @param {string} timezone - The timezone for calculation
 * @returns {number} - Duration in seconds
 */
export const calculateDurationInSeconds = (startDate, endDate, timezone) => {
  // Convert both dates to the same timezone for accurate calculation
  const startZoned = toZonedTime(startDate, timezone);
  const endZoned = toZonedTime(endDate, timezone);
  
  return differenceInSeconds(endZoned, startZoned);
};

/**
 * Format duration in seconds to human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., '1 h 30 min')
 */
export const formatDuration = (seconds) => {
  if (seconds <= 0) return '0 min';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

/**
 * Parse duration string to seconds
 * @param {string} durationStr - Duration string (e.g., '1 h 30 min', '45 min', '2 h')
 * @returns {number} - Duration in seconds
 */
export const parseDuration = (durationStr) => {
  if (!durationStr) return 0;
  
  const hoursMatch = durationStr.match(/(\d+)\s*h/);
  const minutesMatch = durationStr.match(/(\d+)\s*min/);
  
  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  
  return (hours * 3600) + (minutes * 60);
};

/**
 * Get the date key for storage in the selected timezone
 * @param {Date} date - The date (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @returns {string} - Date key in YYYY-MM-DD format
 */
export const getDateKeyInTimezone = (date, timezone) => {
  return formatInTimezone(date, 'yyyy-MM-dd', timezone);
};

/**
 * Check if a date is "today" in the selected timezone
 * @param {Date} date - The date to check (can be UTC or local)
 * @param {string} timezone - The target timezone
 * @returns {boolean} - True if the date is today in the target timezone
 */
export const isTodayInTimezone = (date, timezone) => {
  const today = getCurrentDateInTimezone(timezone);
  const dateToCheck = toZonedTime(date, timezone);
  
  return format(today, 'yyyy-MM-dd') === format(dateToCheck, 'yyyy-MM-dd');
};

/**
 * Calculate end time from start time and duration in the selected timezone
 * @param {Date} startTime - The start time (can be UTC or local)
 * @param {number} durationSeconds - Duration in seconds
 * @param {string} timezone - The target timezone
 * @returns {Date} - The calculated end time
 */
export const calculateEndTime = (startTime, durationSeconds, timezone) => {
  const startZoned = toZonedTime(startTime, timezone);
  const endZoned = new Date(startZoned.getTime() + durationSeconds * 1000);
  return fromZonedTime(endZoned, timezone);
};
