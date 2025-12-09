import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const WeekNavigator = ({ currentDate, onWeekChange, timezone }) => {
  const { weekStart: userWeekStart } = useUserPreferences();
  const [weekRange, setWeekRange] = useState({ start: null, end: null });

  // Recalculate week range when userWeekStart or currentDate changes
  useEffect(() => {
    const weekStartsOn = userWeekStart === 'sunday' ? 0 : 1; // 0 = Sunday, 1 = Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekEnd = addDays(weekStart, 6);
    setWeekRange({ start: weekStart, end: weekEnd });
    console.log('=== WeekNavigator Week Recalculation ===');
    console.log('User week start:', userWeekStart);
    console.log('Week starts on:', weekStartsOn);
    console.log('Week range:', { start: weekStart, end: weekEnd });
  }, [userWeekStart, currentDate]);
  
  const handlePreviousWeek = () => {
    onWeekChange(subWeeks(currentDate, 1));
  };
  
  const handleNextWeek = () => {
    onWeekChange(addWeeks(currentDate, 1));
  };
  
  const handleCurrentWeek = () => {
    onWeekChange(new Date());
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={handlePreviousWeek}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          ← Previous Week
        </button>
        <button
          onClick={handleCurrentWeek}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          Current Week
        </button>
        <button
          onClick={handleNextWeek}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        >
          Next Week →
        </button>
      </div>
      <div className="text-lg font-semibold text-gray-900">
        {weekRange.start && weekRange.end ? 
          `${format(weekRange.start, 'MMM d, yyyy')} - ${format(weekRange.end, 'MMM d, yyyy')}` : 
          'Loading...'
        }
      </div>
    </div>
  );
};

export default WeekNavigator;
