import React, { useEffect, useState, useRef } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  differenceInMinutes,
  parse,
  isValid
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';

const TimesheetTable = ({ currentDate, timezone, timesheetData, onTimesheetChange, onWeekChange }) => {
  const [localData, setLocalData] = useState(timesheetData || {});
  const { weekStart: userWeekStart } = useUserPreferences();
  const [weekDays, setWeekDays] = useState([]);
  const [copiedField, setCopiedField] = useState(null);
  const copiedTimeoutRef = useRef(null);
  const { success, error } = useToast();

  // Recalculate week days when userWeekStart or currentDate changes
  useEffect(() => {
    const weekStartsOn = userWeekStart === 'sunday' ? 0 : 1; // 0 = Sunday, 1 = Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const newWeekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    setWeekDays(newWeekDays);
  }, [userWeekStart, currentDate]);

  // Helper function to get storage date key (same as DailyTracker)
  const getStorageDateKey = (date) => {
    if (date) {
      // Simple approach: use the date directly with formatting
      return format(date, 'yyyy-MM-dd');
    }
    // Use current date without timezone conversion
    return format(new Date(), 'yyyy-MM-dd');
  };

  // Check if selected week is the current week
  const isCurrentWeek = () => {
    const weekStartsOn = userWeekStart === 'sunday' ? 0 : 1;
    const selectedWeekStart = startOfWeek(currentDate, { weekStartsOn });
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn });
    return selectedWeekStart.getTime() === currentWeekStart.getTime();
  };

  // Week navigation functions
  const handlePreviousWeek = () => {
    if (onWeekChange) {
      onWeekChange(subWeeks(currentDate, 1));
    }
  };

  const handleNextWeek = () => {
    if (onWeekChange) {
      onWeekChange(addWeeks(currentDate, 1));
    }
  };

  const handleCurrentWeek = () => {
    if (onWeekChange) {
      onWeekChange(new Date());
    }
  };

  // Calculate total hours for a single day. Accepts both "HH:mm" (legacy) and
  // "HH:mm:ss" (current) — seconds default to 0 when absent so precision is
  // preserved for new entries without breaking older ones.
  const calculateDayTotal = (timeIn, timeOut, breakHours) => {
    if (!timeIn || !timeOut) return 0;

    try {
      const [inH = 0, inM = 0, inS = 0] = timeIn.split(':').map(Number);
      const [outH = 0, outM = 0, outS = 0] = timeOut.split(':').map(Number);

      const inSeconds = (inH * 3600) + (inM * 60) + inS;
      const outSeconds = (outH * 3600) + (outM * 60) + outS;

      let totalSeconds = outSeconds - inSeconds;
      if (totalSeconds < 0) totalSeconds += 24 * 3600;

      const totalHours = (totalSeconds / 3600) - (parseFloat(breakHours) || 0);
      return Math.max(0, totalHours);
    } catch (error) {
      console.error('Error calculating time:', error);
      return 0;
    }
  };

  // Calculate grand total for the week
  const calculateGrandTotal = () => {
    return weekDays.reduce((total, day) => {
      const dayKey = getStorageDateKey(day);
      const dayData = localData[dayKey] || {};
      const dayTotal = calculateDayTotal(
        dayData.timeIn,
        dayData.timeOut,
        dayData.breakHours
      );
      return total + dayTotal;
    }, 0);
  };

  // Handle input changes
  const handleInputChange = (dayKey, field, value) => {
    const newData = { ...localData };
    if (!newData[dayKey]) {
      newData[dayKey] = {
        tasks: '',
        workDetails: '',
        timeIn: '',
        timeOut: '',
        breakHours: '0'
      };
    }
    newData[dayKey][field] = value;
    setLocalData(newData);
    onTimesheetChange(newData);
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async (text, fieldIdentifier) => {
    if (!text) {
      error('Nothing to copy');
      return;
    }

    // Convert time format if it's a time field
    let textToCopy = text;
    if (fieldIdentifier.includes('timeIn') || fieldIdentifier.includes('timeOut')) {
      textToCopy = convertTo12HourFormat(text);
    }
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedField(fieldIdentifier);
      success('Copied to clipboard!');
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = setTimeout(() => {
        setCopiedField(null);
        copiedTimeoutRef.current = null;
      }, 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      error('Failed to copy text');
    }
  };

  // Convert 24-hour time to 12-hour format with AM/PM. Preserves seconds when
  // present so copy-to-clipboard doesn't drop precision.
  const convertTo12HourFormat = (time24) => {
    if (!time24) return time24;

    const [hours, minutes, seconds] = time24.split(':');
    const hour = parseInt(hours);

    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 0 to 12

    return seconds != null
      ? `${hour12}:${minutes}:${seconds} ${period}`
      : `${hour12}:${minutes} ${period}`;
  };

  // Sync with props
  useEffect(() => {
    setLocalData(timesheetData);
  }, [timesheetData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div>
      {/* Week Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Unbounded display font with tabular-nums numerals — matches
                  the Tracker date and Pomodoro timer "number font" treatment.
                  tabular-nums only affects digits, so month names stay normal. */}
              <h1 className="font-display text-3xl font-semibold text-gray-900 tracking-tight tabular-nums">
                <span className="sm:hidden">
                  {weekDays[0] && weekDays[6] ?
                    `${format(weekDays[0], 'MMM')}. ${format(weekDays[0], 'd')} - ${format(weekDays[6], 'd')}` :
                    'Loading...'
                  }
                </span>
                <span className="hidden sm:inline lg:hidden">
                  {weekDays[0] && weekDays[6] ?
                    `${format(weekDays[0], 'MMM')}. ${format(weekDays[0], 'd')} - ${format(weekDays[6], 'MMM')}. ${format(weekDays[6], 'd')}` :
                    'Loading...'
                  }
                </span>
                <span className="hidden lg:inline">
                  {weekDays[0] && weekDays[6] ? 
                    `${format(weekDays[0], 'MMMM d, yyyy')} - ${format(weekDays[6], 'MMMM d, yyyy')}` : 
                    'Loading...'
                  }
                </span>
              </h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isCurrentWeek() ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {isCurrentWeek() ? 'Current' : 'Overview'}
          </span>
          <button
            onClick={handlePreviousWeek}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={handleCurrentWeek}
            className={`p-2 rounded-lg transition-colors duration-150 ${
              isCurrentWeek()
                ? 'cursor-not-allowed'
                : 'hover:bg-gray-100'
            }`}
            title={isCurrentWeek() ? "Current week" : "Back to Current Week"}
            disabled={isCurrentWeek()}
          >
            <div className={`w-2 h-2 rounded-full ${isCurrentWeek() ? 'bg-gray-400' : 'bg-blue-600'}`}></div>
          </button>

          <button
            onClick={handleNextWeek}
            className={`p-2 rounded-lg transition-colors duration-150 ${
              isCurrentWeek()
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title={isCurrentWeek() ? "Current week" : "Next Week"}
            disabled={isCurrentWeek()}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile: stacked card-per-day. The wide table below is squeezed to
          unreadability on phones, so under sm: we render the same fields
          one day at a time. Both layouts share the same handlers and state. */}
      <div className="sm:hidden space-y-3">
        {weekDays.map((day, index) => {
          const dayKey = getStorageDateKey(day);
          const dayData = localData[dayKey] || {};
          const dayTotal = calculateDayTotal(
            dayData.timeIn,
            dayData.timeOut,
            dayData.breakHours
          );
          const dayNames = userWeekStart === 'sunday'
            ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const isWeekend = index >= 5;

          return (
            <div
              key={dayKey}
              className={`rounded-2xl border border-gray-200/80 shadow-xs ${
                isWeekend ? 'bg-gray-50/70' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-900">
                  {dayNames[index]}, {format(day, 'MMM d')}
                </div>
                <div className="text-sm font-mono text-gray-700 tabular-nums">
                  {dayTotal.toFixed(2)} h
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Tasks
                  </label>
                  <input
                    type="text"
                    value={dayData.tasks || ''}
                    onChange={(e) => handleInputChange(dayKey, 'tasks', e.target.value)}
                    placeholder="Enter tasks..."
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 bg-white rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Work Details
                  </label>
                  <input
                    type="text"
                    value={dayData.workDetails || ''}
                    onChange={(e) => handleInputChange(dayKey, 'workDetails', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.workDetails, `${dayKey}-workDetails`)}
                    placeholder="Describe work done..."
                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 ${
                      copiedField === `${dayKey}-workDetails`
                        ? 'bg-green-100 border-green-400'
                        : 'border-gray-200 bg-white'
                    }`}
                    title="Click to copy"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Time In
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={dayData.timeIn || ''}
                      onChange={(e) => handleInputChange(dayKey, 'timeIn', e.target.value)}
                      onClick={() => handleCopyToClipboard(dayData.timeIn, `${dayKey}-timeIn`)}
                      className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 ${
                        copiedField === `${dayKey}-timeIn`
                          ? 'bg-green-100 border-green-400'
                          : 'border-gray-200 bg-white'
                      }`}
                      title="Click to copy"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Time Out
                    </label>
                    <input
                      type="time"
                      step="1"
                      value={dayData.timeOut || ''}
                      onChange={(e) => handleInputChange(dayKey, 'timeOut', e.target.value)}
                      onClick={() => handleCopyToClipboard(dayData.timeOut, `${dayKey}-timeOut`)}
                      className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 ${
                        copiedField === `${dayKey}-timeOut`
                          ? 'bg-green-100 border-green-400'
                          : 'border-gray-200 bg-white'
                      }`}
                      title="Click to copy"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Break Hours
                  </label>
                  <input
                    type="number"
                    value={dayData.breakHours || '0'}
                    onChange={(e) => handleInputChange(dayKey, 'breakHours', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.breakHours, `${dayKey}-breakHours`)}
                    min="0"
                    max="24"
                    step="0.5"
                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 ${
                      copiedField === `${dayKey}-breakHours`
                        ? 'bg-green-100 border-green-400'
                        : 'border-gray-200 bg-white'
                    }`}
                    title="Click to copy"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-gray-200/80 shadow-xs bg-gray-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Grand Total</span>
          <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">
            {calculateGrandTotal().toFixed(2)} h
          </span>
        </div>
      </div>

      {/* Desktop / tablet: original wide table */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-2xl border border-gray-200/80 shadow-xs">
      <table className="min-w-full bg-white overflow-hidden">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Tasks
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Work Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Time In
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Time Out
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Break Hours
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Total Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {weekDays.map((day, index) => {
            const dayKey = getStorageDateKey(day);
            const dayData = localData[dayKey] || {};
            const dayTotal = calculateDayTotal(
              dayData.timeIn,
              dayData.timeOut,
              dayData.breakHours
            );

            const dayNames = userWeekStart === 'sunday' 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const isWeekend = index >= 5; // Saturday and Sunday

            return (
              <tr
                key={dayKey}
                className={`transition-colors duration-150 ${isWeekend ? 'bg-gray-50/70' : 'hover:bg-gray-50/70'}`}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 w-32 min-w-32">
                  {dayNames[index]}, {format(day, 'MMM d')}
                </td>
                <td className="px-4 py-3 w-32">
                  <input
                    type="text"
                    value={dayData.tasks || ''}
                    onChange={(e) => handleInputChange(dayKey, 'tasks', e.target.value)}
                    placeholder="Enter tasks..."
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 bg-white rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  />
                </td>
                <td className="px-4 py-3 min-w-32">
                  <input
                    type="text"
                    value={dayData.workDetails || ''}
                    onChange={(e) => handleInputChange(dayKey, 'workDetails', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.workDetails, `${dayKey}-workDetails`)}
                    placeholder="Describe work done..."
                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 ${
                      copiedField === `${dayKey}-workDetails` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-20 min-w-20">
                  <input
                    type="time"
                    step="1"
                    value={dayData.timeIn || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeIn', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.timeIn, `${dayKey}-timeIn`)}
                    className={`px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 [-moz-appearance:_textfield] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                      copiedField === `${dayKey}-timeIn`
                        ? 'bg-green-100 border-green-400'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-20 min-w-20">
                  <input
                    type="time"
                    step="1"
                    value={dayData.timeOut || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeOut', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.timeOut, `${dayKey}-timeOut`)}
                    className={`px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 [-moz-appearance:_textfield] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                      copiedField === `${dayKey}-timeOut`
                        ? 'bg-green-100 border-green-400'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-22 min-w-22">
                  <input
                    type="number"
                    value={dayData.breakHours || '0'}
                    onChange={(e) => handleInputChange(dayKey, 'breakHours', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.breakHours, `${dayKey}-breakHours`)}
                    min="0"
                    max="24"
                    step="0.5"
                    className={`w-full px-2.5 py-1.5 text-sm border rounded-lg shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-colors duration-150 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                      copiedField === `${dayKey}-breakHours` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums w-24 min-w-20">
                  {dayTotal.toFixed(2)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-gray-50 font-semibold">
            <td colSpan="6" className="px-4 py-3 text-sm text-gray-900 text-right">
              Grand Total:
            </td>
            <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">
              {calculateGrandTotal().toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

      {/* Empty-week notice */}
      {weekDays.length > 0 && calculateGrandTotal() === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-gray-50 px-4 py-3 text-sm text-gray-500 mt-4">
          <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
          <span>No hours logged for this week yet — fill in your time above.</span>
        </div>
      )}
    </div>
  );
};

export default TimesheetTable;
