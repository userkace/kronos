import React from 'react';
import { format, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DatePicker = ({
  selectedDate,
  onDateChange,
  timezone,
  className = ''
}) => {
  const [showPicker, setShowPicker] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(selectedDate);

  // Format date in user's timezone
  const formatInTimezone = (date, formatStr) => {
    const zonedDate = toZonedTime(date, timezone);
    return format(zonedDate, formatStr, { timeZone: timezone });
  };

  // Get days for the calendar view
  const getCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const daysInLastMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Previous month's days
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, daysInLastMonth - i));
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month's days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const navigateMonth = (increment) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + increment, 1));
  };

  const handleDateSelect = (date) => {
    onDateChange(date);
    setShowPicker(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        title="Select date"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      
      {showPicker && (
        <div 
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            {/* Month Navigation */}
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => navigateMonth(-1)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <button 
                onClick={() => navigateMonth(1)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getCalendarDays(currentMonth).map((day, index) => {
                const dayDate = new Date(day);
                const isSelected = formatInTimezone(dayDate, 'yyyy-MM-dd') === formatInTimezone(selectedDate, 'yyyy-MM-dd');
                const isCurrentMonth = dayDate.getMonth() === currentMonth.getMonth();
                const isToday = formatInTimezone(dayDate, 'yyyy-MM-dd') === formatInTimezone(new Date(), 'yyyy-MM-dd');
                
                return (
                  <button
                    key={index}
                    onClick={() => isCurrentMonth && handleDateSelect(dayDate)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mx-auto ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : isToday 
                          ? 'bg-blue-100 text-blue-800' 
                          : isCurrentMonth 
                            ? 'hover:bg-gray-100' 
                            : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    disabled={!isCurrentMonth}
                    aria-label={`Select ${format(dayDate, 'MMMM d, yyyy')}`}
                  >
                    {dayDate.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
