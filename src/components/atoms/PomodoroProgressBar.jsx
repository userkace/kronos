import React from 'react';
import { usePomodoro } from '../../contexts/PomodoroContext';
import { Brain, Coffee, Timer } from 'lucide-react';

const PomodoroProgressBar = ({ onViewChange, className }) => {
  const {
    isRunning,
    isPaused,
    currentPhase,
    timeLeft,
    workDuration,
    shortBreakDuration,
    longBreakDuration,
    currentSet,
    totalSets,
    currentTask,
    isTrackingTask
  } = usePomodoro();

  // Don't show if timer is not running
  if (!isRunning && !isPaused) {
    return null;
  }

  // Calculate total time for current phase
  const getTotalTime = () => {
    switch (currentPhase) {
      case 'work':
        return workDuration * 60;
      case 'shortBreak':
        return shortBreakDuration * 60;
      case 'longBreak':
        return longBreakDuration * 60;
      default:
        return workDuration * 60;
    }
  };

  // Calculate progress percentage
  const totalTime = getTotalTime();
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  // Get phase icon
  const getPhaseIcon = () => {
    switch (currentPhase) {
      case 'work':
        return <Brain className="w-4 h-4" />;
      case 'shortBreak':
      case 'longBreak':
        return <Coffee className="w-4 h-4" />;
      default:
        return <Timer className="w-4 h-4" />;
    }
  };

  // Get phase color
  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'work':
        return 'bg-blue-500';
      case 'shortBreak':
        return 'bg-green-500';
      case 'longBreak':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get phase text
  const getPhaseText = () => {
    switch (currentPhase) {
      case 'work':
        return truncateTaskName(currentTask);
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      default:
        return 'Timer';
    }
  };

  // Truncate task name to 20 characters
  const truncateTaskName = (taskName) => {
    if (!taskName || taskName.length <= 15) {
      return taskName;
    }
    return taskName.substring(0, 15) + '...';
  };

  return (
    <div
      className={`mb-4 p-3 bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${className}`}
      onClick={() => onViewChange && onViewChange('pomodoro')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`p-1 rounded-full text-white ${getPhaseColor()}`}>
            {getPhaseIcon()}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {getPhaseText()}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-mono text-gray-600">
            {formatTime(timeLeft)}
          </span>
          {isPaused && (
            <span className="text-xs text-orange-600 font-medium">
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full transition-all duration-1000 ${getPhaseColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Additional Info */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          Set {currentSet} of {totalSets}
        </span>
        {currentPhase === 'work' && isTrackingTask && currentTask && (
          <span className="ml-2" title={currentTask}>
            Work Session
          </span>
        )}
      </div>
    </div>
  );
};

export default PomodoroProgressBar;
