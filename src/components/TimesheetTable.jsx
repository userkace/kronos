import React, { useEffect, useState } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  differenceInMinutes,
  parse,
  isValid
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TimesheetTable = ({ currentDate, timezone, timesheetData, onTimesheetChange }) => {
  const [localData, setLocalData] = useState(timesheetData || {});

  // Helper function to get storage date key (same as DailyTracker)
  const getStorageDateKey = (date) => {
    if (date) {
      // Simple approach: use the date directly with formatting
      return format(date, 'yyyy-MM-dd');
    }
    // Use current date without timezone conversion
    return format(new Date(), 'yyyy-MM-dd');
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  // Sync with props
  useEffect(() => {
    setLocalData(timesheetData);
  }, [timesheetData]);

  return (
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

            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const isWeekend = index >= 5; // Saturday and Sunday

            return (
              <tr
                key={dayKey}
                className={isWeekend ? 'bg-gray-50' : 'hover:bg-gray-50'}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {dayNames[index]}, {format(day, 'MMM d')}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={dayData.tasks || ''}
                    onChange={(e) => handleInputChange(dayKey, 'tasks', e.target.value)}
                    placeholder="Enter tasks..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={dayData.workDetails || ''}
                    onChange={(e) => handleInputChange(dayKey, 'workDetails', e.target.value)}
                    placeholder="Describe work done..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={dayData.timeIn || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeIn', e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={dayData.timeOut || ''}
                    onChange={(e) => handleInputChange(dayKey, 'timeOut', e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={dayData.breakHours || '0'}
                    onChange={(e) => handleInputChange(dayKey, 'breakHours', e.target.value)}
                    min="0"
                    max="24"
                    step="0.5"
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
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
  );
};

export default TimesheetTable;
