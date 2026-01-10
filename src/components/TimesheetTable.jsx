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
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    console.log('=== TimesheetTable Week Recalculation ===');
    console.log('User week start:', userWeekStart);
    console.log('Week starts on:', weekStartsOn);
    console.log('New week days:', newWeekDays);
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

  // Calculate total hours for a single day
  const calculateDayTotal = (timeIn, timeOut, breakHours) => {
    if (!timeIn || !timeOut) return 0;

    try {
      console.log('=== Day Total Calculation Debug ===');
      console.log('Time In:', timeIn);
      console.log('Time Out:', timeOut);
      console.log('Break Hours:', breakHours);

      // Split time strings to get hours and minutes
      const [inHours, inMinutes] = timeIn.split(':').map(Number);
      const [outHours, outMinutes] = timeOut.split(':').map(Number);

      console.log('In Hours/Minutes:', inHours, inMinutes);
      console.log('Out Hours/Minutes:', outHours, outMinutes);

      // Convert to total minutes
      const inTotalMinutes = (inHours * 60) + inMinutes;
      const outTotalMinutes = (outHours * 60) + outMinutes;

      console.log('In Total Minutes:', inTotalMinutes);
      console.log('Out Total Minutes:', outTotalMinutes);

      // Calculate difference
      let totalMinutes = outTotalMinutes - inTotalMinutes;

      // Handle overnight shifts
      if (totalMinutes < 0) {
        totalMinutes = totalMinutes + (24 * 60);
      }

      console.log('Total Minutes:', totalMinutes);
      console.log('Total Hours (raw):', totalMinutes / 60);

      // Convert to hours and subtract break hours
      const totalHours = (totalMinutes / 60) - (parseFloat(breakHours) || 0);

      console.log('Total Hours (after break):', totalHours);
      console.log('Final Result:', Math.max(0, totalHours));

      // Don't allow negative hours
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

  // Convert 24-hour time to 12-hour format with AM/PM
  const convertTo12HourFormat = (time24) => {
    if (!time24) return time24;
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const minute = minutes;
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 0 to 12
    
    return `${hour12}:${minute} ${period}`;
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
          <div className="flex items-center space-x-3">
            <div className="relative">
              <h1 className="text-3xl font-bold text-gray-900">
                <span className="sm:hidden">
                  {weekDays[0] && weekDays[6] ? 
                    `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d')}` : 
                    'Loading...'
                  }
                </span>
                <span className="hidden sm:inline lg:hidden">
                  {weekDays[0] && weekDays[6] ? 
                    `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}` : 
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
        <div className="flex items-center space-x-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${isCurrentWeek() ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
            {isCurrentWeek() ? 'Current' : 'Overview'}
          </span>
          <button
            onClick={handlePreviousWeek}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={handleCurrentWeek}
            className={`p-2 rounded-lg transition-colors ${
              isCurrentWeek()
                ? 'cursor-not-allowed'
                : 'hover:bg-gray-200'
            }`}
            title={isCurrentWeek() ? "Current week" : "Back to Current Week"}
            disabled={isCurrentWeek()}
          >
            <div className={`w-2 h-2 rounded-full ${isCurrentWeek() ? 'bg-gray-400' : 'bg-blue-600'}`}></div>
          </button>

          <button
            onClick={handleNextWeek}
            className={`p-2 rounded-lg transition-colors ${
              isCurrentWeek()
                ? 'cursor-not-allowed text-gray-400'
                : 'hover:bg-gray-200'
            }`}
            title={isCurrentWeek() ? "Current week" : "Next Week"}
            disabled={isCurrentWeek()}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timesheet Table */}
      <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tasks
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Work Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time In
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time Out
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Break Hours
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Hours
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
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
                className={isWeekend ? 'bg-gray-50' : 'hover:bg-gray-50'}
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
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3 min-w-32">
                  <input
                    type="text"
                    value={dayData.workDetails || ''}
                    onChange={(e) => handleInputChange(dayKey, 'workDetails', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.workDetails, `${dayKey}-workDetails`)}
                    placeholder="Describe work done..."
                    className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors ${
                      copiedField === `${dayKey}-workDetails` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-20 min-w-20">
                  <input
                    type="time"
                    value={dayData.timeIn || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeIn', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.timeIn, `${dayKey}-timeIn`)}
                    className={`px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors ${
                      copiedField === `${dayKey}-timeIn` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-20 min-w-20">
                  <input
                    type="time"
                    value={dayData.timeOut || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeOut', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.timeOut, `${dayKey}-timeOut`)}
                    className={`px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors ${
                      copiedField === `${dayKey}-timeOut` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 w-20 min-w-20">
                  <input
                    type="number"
                    value={dayData.breakHours || '0'}
                    onChange={(e) => handleInputChange(dayKey, 'breakHours', e.target.value)}
                    onClick={() => handleCopyToClipboard(dayData.breakHours, `${dayKey}-breakHours`)}
                    min="0"
                    max="24"
                    step="0.5"
                    className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-colors [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none ${
                      copiedField === `${dayKey}-breakHours` 
                        ? 'bg-green-100 border-green-400' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    title="Click to copy"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 w-24 min-w-20">
                  {dayTotal.toFixed(2)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-semibold">
            <td colSpan="6" className="px-4 py-3 text-sm text-gray-900 text-right">
              Grand Total:
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              {calculateGrandTotal().toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
};

export default TimesheetTable;
