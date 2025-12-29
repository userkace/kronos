import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Timer, Settings as SettingsIcon, SkipForward } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { usePomodoro } from '../contexts/PomodoroContext';

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
    setCurrentPhase,
    setCurrentSet,
    setCompletedSets,
    setCurrentTask,
    setIsTrackingTask,
    setTaskStartTime,
    selectedTimezone: pomodoroTimezone
  } = usePomodoro();
  
  // Local state
  const [showSettings, setShowSettings] = useState(false);
  const [totalTime, setTotalTime] = useState(workDuration * 60);
  
  const audioRef = useRef(null);

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
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pomodoro Timer</h1>
            <p className="text-gray-600 mt-2">Stay focused with time management technique</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Timer Settings</h3>
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
                  onChange={(e) => setWorkDuration(parseInt(e.target.value) || 25)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setShortBreakDuration(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setLongBreakDuration(parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  onChange={(e) => setTotalSets(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isRunning}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoStartBreaks}
                  onChange={(e) => setAutoStartBreaks(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Auto-start breaks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoStartWork}
                  onChange={(e) => setAutoStartWork(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Auto-start work sessions</span>
              </label>
            </div>
          </div>
        )}

        {/* Task Input */}
        {!isTrackingTask && (
            <div className="mb-8">
            <input
                type="text"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                placeholder="What are you working on?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
            />
            </div>
        )}

        {/* Status Information */}
        {isTrackingTask && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-2 text-blue-800">
              <Timer className="w-5 h-5" />
              <span className="font-medium">Tracking time for: {currentTask}</span>
            </div>
          </div>
        )}
{isTrackingTask && (
<>
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${getPhaseColor()} text-white mb-4`}>
            {getPhaseIcon()}
          </div>
          <div className="text-6xl font-bold text-gray-900 mb-2">
            {formatTime(timeLeft)}
          </div>
          <div className="text-lg text-gray-600 capitalize">
            {currentPhase === 'work' ? 'Work Session' : 
             currentPhase === 'shortBreak' ? 'Short Break' : 'Long Break'}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Set {currentSet} of {totalSets}
          </div>
        </div>


        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${getPhaseColor()}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
</>
)}

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          {!isRunning ? (
            <button
              onClick={handleStartTimer}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={currentPhase === 'work' && !currentTask.trim()}
            >
              <Play className="w-5 h-5" />
              <span>Start</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={resumeTimer}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="w-5 h-5" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Pause className="w-5 h-5" />
              <span>Pause</span>
            </button>
          )}
          
          <button
            onClick={resetTimer}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Reset</span>
          </button>
          
          <button
            onClick={skipPhase}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip</span>
          </button>
          
          <button
            onClick={resetAll}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <span>Reset All</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PomodoroTimer;
