import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Timer, Settings as SettingsIcon, SkipForward } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { loadTimesheetData } from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import {
  DEFAULT_WORK_DURATION,
  DEFAULT_SHORT_BREAK,
  DEFAULT_LONG_BREAK,
  DEFAULT_TOTAL_SETS,
} from '../constants/defaults';

const PomodoroTimer = () => {
  const { success, error } = useToast();

  // Use Pomodoro context for all state
  const {
    workDuration,
    setWorkDuration,
    shortBreakDuration,
    setShortBreakDuration,
    longBreakDuration,
    setLongBreakDuration,
    totalSets,
    setTotalSets,
    autoStartBreaks,
    setAutoStartBreaks,
    autoStartWork,
    setAutoStartWork,
    // Timer state
    isRunning,
    isPaused,
    setIsRunning,
    setIsPaused,
    currentPhase,
    timeLeft,
    setTimeLeft,
    currentSet,
    currentTask,
    isTrackingTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipPhase,
    resetAll,
    setCurrentTask,
    setIsTrackingTask,
    setTaskStartTime
  } = usePomodoro();

  // Local state
  const [showSettings, setShowSettings] = useState(false);
  const [totalTime, setTotalTime] = useState(workDuration * 60);
  const [hasActiveTimerEntry, setHasActiveTimerEntry] = useState(false);

  const audioRef = useRef(null);

  // Helper function to check for active timer entries
  const checkForActiveTimerEntries = () => {
    const allData = loadTimesheetData();
    
    // Early return optimization: break loop as soon as active entry is found
    for (const dateKey in allData) {
      const entries = allData[dateKey];
      const activeEntry = entries.find(entry => entry.isActive);
      if (activeEntry) {
        setHasActiveTimerEntry(true);
        return true;
      }
    }
    
    setHasActiveTimerEntry(false);
    return false;
  };

  // Check for active entries on mount and when storage changes
  useEffect(() => {
    checkForActiveTimerEntries();
    
    // Subscribe to storage changes using the event system
    const unsubscribe = storageEventSystem.subscribe('kronos_timesheet_data', () => {
      checkForActiveTimerEntries();
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize audio for notifications
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUazi7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
  }, []);

  // Update timer duration based on phase
  useEffect(() => {
    let duration;
    switch (currentPhase) {
      case 'work':
        duration = workDuration * 60;
        // Update task start time when entering a new work phase
        if (currentTask && isTrackingTask) {
          setTaskStartTime(new Date());
        }
        break;
      case 'shortBreak':
        duration = shortBreakDuration * 60;
        break;
      case 'longBreak':
        duration = longBreakDuration * 60;
        break;
      default:
        duration = workDuration * 60;
    }
    setTotalTime(duration);
  }, [currentPhase, workDuration, shortBreakDuration, longBreakDuration, currentTask, isTrackingTask, setTaskStartTime]);

  // Play notification sound when timer completes
  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error('Audio play failed:', e));
      }
    }
  }, [timeLeft, isRunning]);

  const handleStartTimer = () => {
    if (currentPhase === 'work' && currentTask && !isTrackingTask) {
      setTaskStartTime(new Date());
      setIsTrackingTask(true);
    }
    startTimer();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseIcon = () => {
    switch (currentPhase) {
      case 'work':
        return <Brain className="w-6 h-6" />;
      case 'shortBreak':
        return <Coffee className="w-6 h-6" />;
      case 'longBreak':
        return <Coffee className="w-6 h-6" />;
      default:
        return <Timer className="w-6 h-6" />;
    }
  };

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

  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <div className="text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Focus</p>
              <h1 className="mt-1.5 font-display text-lg font-semibold text-gray-900">Pomodoro Timer</h1>
              <p className="mt-1.5 text-sm text-gray-500">Boost productivity with focused work sessions.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
                title="Timer Settings"
                aria-label="Timer settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-base font-semibold mb-4 text-gray-900 tracking-tight">Timer Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={workDuration}
                  onChange={(e) => setWorkDuration(parseInt(e.target.value) || DEFAULT_WORK_DURATION)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={shortBreakDuration}
                  onChange={(e) => setShortBreakDuration(parseInt(e.target.value) || DEFAULT_SHORT_BREAK)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Long Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={longBreakDuration}
                  onChange={(e) => setLongBreakDuration(parseInt(e.target.value) || DEFAULT_LONG_BREAK)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Sets
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={totalSets}
                  onChange={(e) => setTotalSets(parseInt(e.target.value) || DEFAULT_TOTAL_SETS)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoStartBreaks}
                  onChange={(e) => setAutoStartBreaks(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-700">Auto-start breaks</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoStartWork}
                  onChange={(e) => setAutoStartWork(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20"
                />
                <span className="text-sm text-gray-700">Auto-start work sessions</span>
              </label>
            </div>
          </div>
        )}

        {/* Task Input */}
        {!isTrackingTask && (
            <div className="mb-6">
            <input
                type="text"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                placeholder="What are you working on?"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                disabled={isRunning}
            />
            </div>
        )}

        {/* Status Information */}
        {isTrackingTask && (
          <div className="bg-blue-50 border border-blue-200/70 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-blue-800">
              <Timer className="w-5 h-5" />
              <span className="font-medium">Tracking time for: {currentTask}</span>
            </div>
          </div>
        )}
{isTrackingTask && (
<>
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${getPhaseColor()} text-white mb-4`}>
            {getPhaseIcon()}
          </div>
          <div className="text-6xl font-semibold tracking-tight tabular-nums text-gray-900 mb-2">
            {formatTime(timeLeft)}
          </div>
          <div className="text-lg text-gray-600 capitalize">
            {currentPhase === 'work' ? 'Work Session' :
             currentPhase === 'shortBreak' ? 'Short Break' : 'Long Break'}
          </div>
          <div className="text-sm text-gray-500 mt-2 tabular-nums">
            Set {currentSet} of {totalSets}
          </div>
        </div>


        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-[width] duration-1000 ${getPhaseColor()}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
</>
)}

        {/* Control Buttons */}
        <div className="flex justify-center gap-3">
          {!isRunning ? (
            <button
              onClick={handleStartTimer}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                (currentPhase === 'work' && !currentTask.trim()) || hasActiveTimerEntry
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:text-green-700 hover:bg-green-50'
              }`}
              disabled={(currentPhase === 'work' && !currentTask.trim()) || hasActiveTimerEntry}
              title={
                hasActiveTimerEntry 
                  ? 'Cannot start Pomodoro while timer is active in Daily Tracker'
                  : (currentPhase === 'work' && !currentTask.trim())
                    ? 'Please enter a task description'
                    : 'Start Pomodoro timer'
              }
            >
              <Play className="w-4 h-4" />
              <span>Start</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={resumeTimer}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors duration-150"
            >
              <Play className="w-4 h-4" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={resetTimer}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-150"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={skipPhase}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-150"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip</span>
          </button>

          <button
            onClick={resetAll}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
          >
            Reset All
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
