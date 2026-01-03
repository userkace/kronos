import React, { useEffect, useRef } from 'react';
import { format, addMonths, subMonths, addDays, subDays, startOfWeek, endOfWeek, isSameDay, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
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
  const [focusedDate, setFocusedDate] = React.useState(selectedDate || new Date());
  const popupRef = useRef(null);
  const triggerRef = useRef(null);
  const { selectedTimezone } = useTimezone();

  // Close the popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target) && 
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      // Set focus to the first focusable element in the dialog
      const firstFocusable = popupRef.current?.querySelector('button');
      if (firstFocusable) firstFocusable.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showPicker) return;

    const currentDate = focusedDate || selectedDate || new Date();
    let newDate = new Date(currentDate);
    let shouldUpdate = false;

    switch (e.key) {
      case 'Escape':
        setShowPicker(false);
        triggerRef.current?.focus();
        return;
      case 'ArrowLeft':
        newDate = subDays(currentDate, 1);
        shouldUpdate = true;
        break;
      case 'ArrowRight':
        newDate = addDays(currentDate, 1);
        shouldUpdate = true;
        break;
      case 'ArrowUp':
        newDate = subDays(currentDate, 7);
        shouldUpdate = true;
        break;
      case 'ArrowDown':
        newDate = addDays(currentDate, 7);
        shouldUpdate = true;
        break;
      case 'Home':
        newDate = startOfWeek(currentDate);
        shouldUpdate = true;
        break;
      case 'End':
        newDate = endOfWeek(currentDate);
        shouldUpdate = true;
        break;
      case 'PageUp':
        newDate = e.shiftKey ? addMonths(currentDate, -12) : subMonths(currentDate, 1);
        shouldUpdate = true;
        onMonthChange(e.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        newDate = e.shiftKey ? addMonths(currentDate, 12) : addMonths(currentDate, 1);
        shouldUpdate = true;
        onMonthChange(e.shiftKey ? 12 : 1);
        break;
      case ' ':
      case 'Enter':
        if (document.activeElement.getAttribute('role') === 'gridcell') {
          document.activeElement.click();
        }
        return;
      default:
        return;
    }

    if (shouldUpdate) {
      e.preventDefault();
      setFocusedDate(newDate);
      
      // Update month view if needed
      if (!isSameMonth(newDate, currentDate)) {
        const monthDiff = (newDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                         (newDate.getMonth() - currentDate.getMonth());
        onMonthChange(monthDiff);
      }
    }
  };

  // Focus the selected date when the popup opens or the month changes
  useEffect(() => {
    if (showPicker && popupRef.current) {
      const selectedButton = popupRef.current.querySelector('[aria-selected="true"]');
      if (selectedButton) {
        selectedButton.focus();
      } else if (focusedDate) {
        const focusedButton = popupRef.current.querySelector(`[data-date="${focusedDate.toISOString()}"]`);
        if (focusedButton) focusedButton.focus();
      }
    }
  }, [showPicker, focusedDate, calendarDays]);

  // Format date for display in the selected timezone
  const formatDate = (date, formatStr) => {
    if (!date || !selectedTimezone) return '';
    // Convert to the selected timezone before formatting
    const zonedDate = toZonedTime(date, selectedTimezone);
    return format(zonedDate, formatStr);
  };

  // Check if a date is the selected date (timezone aware)
  const isDateSelected = (date) => {
    if (!selectedDate || !date || !selectedTimezone) return false;
    // Compare dates in the selected timezone
    const date1 = toZonedTime(date, selectedTimezone);
    const date2 = toZonedTime(selectedDate, selectedTimezone);
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  // Check if a date is today (timezone aware)
  const isDateToday = (date) => {
    if (!date || !selectedTimezone) return false;
    const today = toZonedTime(new Date(), selectedTimezone);
    const dateInTZ = toZonedTime(date, selectedTimezone);
    return (
      dateInTZ.getDate() === today.getDate() &&
      dateInTZ.getMonth() === today.getMonth() &&
      dateInTZ.getFullYear() === today.getFullYear()
    );
  };

  // Check if a date is in the future (timezone aware)
  const isFutureDate = (date) => {
    if (!date || !selectedTimezone) return false;
    const today = toZonedTime(new Date(), selectedTimezone);
    const dateInTZ = toZonedTime(date, selectedTimezone);

    // Reset hours, minutes, seconds, and milliseconds for accurate date comparison
    const dateToCompare = new Date(dateInTZ);
    dateToCompare.setHours(0, 0, 0, 0);
    const todayToCompare = new Date(today);
    todayToCompare.setHours(0, 0, 0, 0);

    return dateToCompare > todayToCompare;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => {
          setShowPicker(!showPicker);
          setFocusedDate(selectedDate || new Date());
        }}
        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        aria-haspopup="dialog"
        aria-expanded={showPicker}
        aria-label={`Choose date, selected date is ${formatDate(selectedDate, 'MMMM d, yyyy')}`}
        title={`Select date (${formatDate(selectedDate, 'MMMM d, yyyy')})`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {showPicker && (
        <div
          ref={popupRef}
          role="dialog"
          aria-modal="true"
          aria-label="Calendar"
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          tabIndex="-1"
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
              <div 
                className="font-medium"
                id="month-year"
                aria-live="polite"
              >
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
            <div 
              role="row" 
              className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 mb-2"
              aria-hidden="true"
            >
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
                <div key={day} className="py-1" role="columnheader" aria-label={day}>
                  <abbr title={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}>
                    {day}
                  </abbr>
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div 
              role="grid" 
              aria-labelledby="month-year"
              className="grid grid-cols-7 gap-1 w-full"
              aria-activedescendant={focusedDate ? `date-${format(focusedDate, 'yyyy-MM-dd')}` : undefined}
            >
              {calendarDays.map((day, index) => {
                // Convert day to the selected timezone for display and comparison
                const zonedDay = selectedTimezone ? toZonedTime(day, selectedTimezone) : day;
                const isSelected = isDateSelected(day);
                const isToday = isDateToday(day);
                
                // Check if day is in the current month being displayed
                const currentMonth = calendarDays[15] ? 
                  toZonedTime(calendarDays[15], selectedTimezone).getMonth() : 
                  toZonedTime(new Date(), selectedTimezone).getMonth();
                const isCurrentMonth = zonedDay.getMonth() === currentMonth;

                return (
                  <div 
                    key={index}
                    role="gridcell"
                    className="flex items-center justify-center w-8 h-8 mx-auto"
                    aria-selected={isSelected}
                  >
                    <button
                      onClick={(e) => {
                        onDateChange(day);
                        setFocusedDate(day);
                        
                        // Check if the selected date is in a different month than the current view
                        // Use timezone-aware comparison to avoid edge cases with timezone conversion
                        const currentViewDate = calendarDays[15] ? 
                          toZonedTime(calendarDays[15], selectedTimezone) : 
                          toZonedTime(new Date(), selectedTimezone);
                        const currentViewMonth = currentViewDate.getMonth();
                        const currentViewYear = currentViewDate.getFullYear();
                        
                        const selectedDateInTZ = toZonedTime(day, selectedTimezone);
                        const selectedMonth = selectedDateInTZ.getMonth();
                        const selectedYear = selectedDateInTZ.getFullYear();

                        if (selectedMonth !== currentViewMonth || selectedYear !== currentViewYear) {
                          const monthDiff = (selectedYear - currentViewYear) * 12 + (selectedMonth - currentViewMonth);
                          onMonthChange(monthDiff);
                        }

                        setShowPicker(false);
                        triggerRef.current?.focus();
                      }}
                      id={`date-${format(zonedDay, 'yyyy-MM-dd')}`}
                      data-date={day.toISOString()}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isSelected
                          ? 'bg-blue-600 text-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                          : isToday
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 focus:bg-blue-200'
                            : isFutureDate(day)
                              ? 'text-gray-300 cursor-not-allowed'
                              : !isCurrentMonth
                                ? 'text-gray-400 hover:bg-gray-50 focus:bg-gray-50'
                                : 'hover:bg-gray-100 focus:bg-gray-100'
                      } focus:outline-none`}
                      disabled={isFutureDate(day)}
                      aria-label={`${format(zonedDay, 'EEEE, MMMM d, yyyy')}${isSelected ? ' (selected)' : ''}${!isCurrentMonth ? ' (not in current month)' : ''}`}
                      tabIndex={isSelected ? 0 : -1}
                    >
                      {zonedDay.getDate()}
                    </button>
                  </div>
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
