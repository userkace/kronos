import React from 'react';
import { Play } from 'lucide-react';
import { loadTimesheetData } from '../../utils/storage';
import storageEventSystem from '../../utils/storageEvents';

const DailyTrackerProgressBar = ({ onViewChange, className, timezone }) => {
  const [activeEntry, setActiveEntry] = React.useState(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Check for active entries
  const checkActiveEntry = () => {
    try {
      const allData = loadTimesheetData();
      let foundActive = null;

      for (const dateKey of Object.keys(allData)) {
        const entries = allData[dateKey];
        const activeInDate = entries.find(entry => entry.isActive);
        if (activeInDate) {
          foundActive = activeInDate;
          break; // Exit early since only one entry can be active
        }
      }

      setActiveEntry(foundActive);
    } catch (error) {
      console.error('Error checking active entry:', error);
    }
  };

  // Update current time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for active entries on mount and when storage changes
  React.useEffect(() => {
    checkActiveEntry();

    // Subscribe to storage changes using the event system
    const unsubscribe = storageEventSystem.subscribe('kronos_timesheet_data', () => {
      checkActiveEntry();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Helper function to calculate elapsed seconds
  const getElapsedSeconds = () => {
    if (!activeEntry) return 0;

    try {
      const startTime = new Date(activeEntry.startTime);
      const currentTimeMs = currentTime.getTime();
      const startTimeMs = startTime.getTime();
      return Math.floor((currentTimeMs - startTimeMs) / 1000);
    } catch (error) {
      console.error('Error calculating elapsed seconds:', error);
      return 0;
    }
  };

  // Calculate duration for active entry
  const getActiveDuration = () => {
    if (!activeEntry) return '0:00:00';

    const seconds = getElapsedSeconds();
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration for display
  const formatDisplayDuration = () => {
    if (!activeEntry) return '0s';

    const seconds = getElapsedSeconds();

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  // Don't show if no active entry
  if (!activeEntry) {
    return null;
  }

  return (
    <div
      className={`mb-4 p-3 bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${className}`}
      onClick={() => onViewChange && onViewChange('tracker')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-full bg-green-500 text-white">
            <Play className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {activeEntry.description?.length > 15
            ? activeEntry.description.substring(0, 15) + '...'
            : activeEntry.description}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-mono text-gray-600">
            {getActiveDuration()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2 relative overflow-hidden">
        <div
          className="h-2 rounded-full bg-green-500 relative"
          style={{ width: '100%' }}
        >
          {/* Animated beam effect */}
          <div
            className="absolute inset-0 bg-linear-to-r from-transparent via-white to-transparent opacity-30"
            style={{
              animation: 'beam 2s infinite',
              transform: 'translateX(-100%)'
            }}
          />
        </div>
      </div>

      {/* Additional Info */}
      <div className="flex justify-between text-xs text-gray-500">
        <span className="font-medium" title={activeEntry.description}>
          Active Task
        </span>
        <span>
          {formatDisplayDuration()}
        </span>
      </div>
    </div>
  );
};

export default DailyTrackerProgressBar;
