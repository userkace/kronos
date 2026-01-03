import React, { useEffect, useRef } from 'react';
import { format, addMonths, subMonths, addDays, subDays, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, ArrowDownLeft } from 'lucide-react';
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
  const [viewMode, setViewMode] = React.useState('days'); // 'days', 'months', 'years'
  const [currentDisplayDate, setCurrentDisplayDate] = React.useState(new Date());
  const [yearRangeStart, setYearRangeStart] = React.useState(new Date().getFullYear() - 10);
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
    let newDate = new Date(currentDate); //Gets overwritten
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
      case 'PageUp': {
        const monthDelta = e.shiftKey ? -12 : -1;
        if (onMonthChange) {
          onMonthChange(monthDelta);
          shouldUpdate = true;
          return;
        }
        newDate = addMonths(currentDate, monthDelta);
        shouldUpdate = true;
        break;
      }
      case 'PageDown': {
        const monthDelta = e.shiftKey ? 12 : 1;
        if (onMonthChange) {
          onMonthChange(monthDelta);
          shouldUpdate = true;
          return;
        }
        newDate = addMonths(currentDate, monthDelta);
        shouldUpdate = true;
        break;
      }
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

  // Update current display date when calendar days change
  useEffect(() => {
    if (calendarDays.length > 0 && calendarDays[15]) {
      setCurrentDisplayDate(new Date(calendarDays[15]));
    }
  }, [calendarDays]);

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

  // Handle month selection
  const handleMonthSelect = (monthIndex) => {
    const newDate = new Date(currentDisplayDate);
    newDate.setMonth(monthIndex);
    setCurrentDisplayDate(newDate);
    
    const monthDiff = (newDate.getFullYear() - currentDisplayDate.getFullYear()) * 12 + 
                     (newDate.getMonth() - currentDisplayDate.getMonth());
    onMonthChange(monthDiff);
    setViewMode('days');
  };

  // Handle year selection
  const handleYearSelect = (year) => {
    const newDate = new Date(currentDisplayDate);
    newDate.setFullYear(year);
    setCurrentDisplayDate(newDate);
    
    const monthDiff = (newDate.getFullYear() - currentDisplayDate.getFullYear()) * 12 + 
                     (newDate.getMonth() - currentDisplayDate.getMonth());
    onMonthChange(monthDiff);
    setViewMode('months');
  };

  // Get months array
  const getMonths = () => {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  };

  // Get years array based on current year range (20 years for 4x5 grid)
  const getYears = () => {
    const years = [];
    for (let i = yearRangeStart; i <= yearRangeStart + 19; i++) {
      years.push(i);
    }
    return years;
  };

  // Get year range title for display
  const getYearRangeTitle = () => {
    const startYear = yearRangeStart;
    const endYear = yearRangeStart + 19;
    return `${startYear}-${endYear}`;
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
                  if (viewMode === 'days') {
                    onMonthChange(-1);
                  } else if (viewMode === 'months') {
                    const newDate = new Date(currentDisplayDate);
                    newDate.setFullYear(newDate.getFullYear() - 1);
                    setCurrentDisplayDate(newDate);
                  } else if (viewMode === 'years') {
                    setYearRangeStart(yearRangeStart - 20);
                  }
                }}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label={viewMode === 'days' ? "Previous month" : viewMode === 'months' ? "Previous year" : "Previous years"}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1 items-center">
                {viewMode === 'days' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('months');
                      }}
                      className="font-medium hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
                      aria-label="Select month"
                    >
                      {formatDate(calendarDays[15] || new Date(), 'MMMM')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('years');
                      }}
                      className="font-medium hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
                      aria-label="Select year"
                    >
                      {formatDate(calendarDays[15] || new Date(), 'yyyy')}
                    </button>
                  </>
                )}
                {viewMode === 'months' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('days');
                      }}
                      className="p-1 rounded-full hover:bg-gray-100"
                      aria-label="Back to days"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('years');
                      }}
                      className="font-medium hover:bg-gray-100 px-2 py-1 rounded cursor-pointer"
                      aria-label="Select year"
                    >
                      {formatDate(currentDisplayDate, 'yyyy')}
                    </button>
                  </>
                )}
                {viewMode === 'years' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode('months');
                      }}
                      className="p-1 rounded-full hover:bg-gray-100"
                      aria-label="Back to months"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                    </button>
                    <div 
                      className="font-medium"
                      aria-live="polite"
                    >
                      {getYearRangeTitle()}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMode === 'days') {
                    onMonthChange(1);
                  } else if (viewMode === 'months') {
                    const newDate = new Date(currentDisplayDate);
                    newDate.setFullYear(newDate.getFullYear() + 1);
                    setCurrentDisplayDate(newDate);
                  } else if (viewMode === 'years') {
                    setYearRangeStart(yearRangeStart + 20);
                  }
                }}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label={viewMode === 'days' ? "Next month" : viewMode === 'months' ? "Next year" : "Next years"}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day headers */}
            {viewMode === 'days' && (
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
            )}

            {/* Calendar days */}
            {viewMode === 'days' && (
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
            )}

            {/* Month selection */}
            {viewMode === 'months' && (
              <div 
                role="grid" 
                className="grid grid-cols-3 gap-2 w-full"
                aria-label="Month selection"
              >
                {getMonths().map((month, index) => {
                  const isCurrentMonth = new Date().getMonth() === index && 
                                       new Date().getFullYear() === currentDisplayDate.getFullYear();
                  const isSelected = selectedDate && 
                                   selectedDate.getMonth() === index && 
                                   selectedDate.getFullYear() === currentDisplayDate.getFullYear();
                  
                  return (
                    <button
                      key={month}
                      onClick={() => handleMonthSelect(index)}
                      className={`p-3 text-sm rounded-lg font-medium ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : isCurrentMonth
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'hover:bg-gray-100'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      aria-label={`Select ${month}`}
                      aria-selected={isSelected}
                    >
                      {month.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Year selection */}
            {viewMode === 'years' && (
              <div 
                role="grid" 
                className="grid grid-cols-4 gap-2 w-full max-h-64 overflow-y-auto"
                aria-label="Year selection"
              >
                {getYears().map((year) => {
                  const isCurrentYear = new Date().getFullYear() === year;
                  const isSelected = selectedDate && selectedDate.getFullYear() === year;
                  
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`p-2 text-sm rounded-lg font-medium ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : isCurrentYear
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'hover:bg-gray-100'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      aria-label={`Select year ${year}`}
                      aria-selected={isSelected}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
