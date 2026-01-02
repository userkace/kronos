import React from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimezone } from '../../contexts/TimezoneContext';

const DatePicker = ({
  selectedDate,
  onDateChange,
  onMonthChange,
  calendarDays = [],
  className = ''
}) => {
  const [showPicker, setShowPicker] = React.useState(false);

  const { selectedTimezone } = useTimezone();
  
  // Format date for display in the selected timezone
  const formatDate = (date, formatStr) => {
    if (!date) return '';
    // Convert to the selected timezone before formatting
    const zonedDate = new Date(
      date.toLocaleString('en-US', { timeZone: selectedTimezone })
    );
    return format(zonedDate, formatStr);
  };

  // Check if a date is the selected date (timezone aware)
  const isDateSelected = (date) => {
    if (!selectedDate || !date) return false;
    // Compare dates in the selected timezone
    const date1 = new Date(date.toLocaleString('en-US', { timeZone: selectedTimezone }));
    const date2 = new Date(selectedDate.toLocaleString('en-US', { timeZone: selectedTimezone }));
    return date1.toDateString() === date2.toDateString();
  };

  // Check if a date is today (timezone aware)
  const isDateToday = (date) => {
    if (!date) return false;
    const today = new Date();
    // Compare dates in the selected timezone
    const dateInTZ = new Date(date.toLocaleString('en-US', { timeZone: selectedTimezone }));
    const todayInTZ = new Date(today.toLocaleString('en-US', { timeZone: selectedTimezone }));
    return (
      dateInTZ.getDate() === todayInTZ.getDate() &&
      dateInTZ.getMonth() === todayInTZ.getMonth() &&
      dateInTZ.getFullYear() === todayInTZ.getFullYear()
    );
  };

  // Check if a date is in the future (timezone aware)
  const isFutureDate = (date) => {
    if (!date) return false;
    const today = new Date();
    // Compare dates in the selected timezone
    const dateInTZ = new Date(date.toLocaleString('en-US', { timeZone: selectedTimezone }));
    const todayInTZ = new Date(today.toLocaleString('en-US', { timeZone: selectedTimezone }));
    
    // Reset hours, minutes, seconds, and milliseconds for accurate date comparison
    const dateToCompare = new Date(dateInTZ);
    dateToCompare.setHours(0, 0, 0, 0);
    const todayToCompare = new Date(todayInTZ);
    todayToCompare.setHours(0, 0, 0, 0);
    
    return dateToCompare > todayToCompare;
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
                onClick={(e) => {
                  e.stopPropagation();
                  onMonthChange(-1);
                }}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-medium">
                {formatDate(calendarDays[15] || new Date(), 'MMMM yyyy')}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMonthChange(1);
                }}
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
              {calendarDays.map((day, index) => {
                if (!day) return <div key={index} className="h-8"></div>;

                const isSelected = isDateSelected(day);
                const isToday = isDateToday(day);
                const isCurrentMonth = calendarDays[15] ? 
                  day.getMonth() === calendarDays[15].getMonth() : 
                  day.getMonth() === new Date().getMonth();

                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateChange(day);
                      setShowPicker(false);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mx-auto ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isToday
                          ? 'bg-blue-100 text-blue-800'
                          : isCurrentMonth
                            ? isFutureDate(day) 
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'hover:bg-gray-100'
                            : 'text-gray-300 hover:bg-gray-50'
                    }`}
                    disabled={!isCurrentMonth || isFutureDate(day)}
                    aria-label={`Select ${format(day, 'MMMM d, yyyy')}`}
                  >
                    {day.getDate()}
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
