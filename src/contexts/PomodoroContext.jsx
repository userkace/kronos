import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { saveTimesheetData, loadTimesheetData } from '../utils/storage';
import { writeWeeklyTimesheetForDates } from '../utils/weeklyTimesheet';
import { generateEntryId } from '../utils/entryUtils';
import { format, addSeconds, differenceInSeconds } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useToast } from './ToastContext';
import { useTimezone } from './TimezoneContext';

const PomodoroContext = createContext();

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error('usePomodoro must be used within a PomodoroProvider');
  }
  return context;
};

export const PomodoroProvider = ({ children }) => {
  // Get toast notifications
  const { success, warning } = useToast();

  // Single source of truth for timezone — previously this provider kept its
  // own copy synced via a 1Hz polling interval and a `storage` listener,
  // which (a) wasted CPU and (b) lagged same-tab changes by up to 1s,
  // potentially landing pomodoro entries on the wrong day near midnight.
  const { selectedTimezone } = useTimezone();

  // Snapshot of the persisted timer state at component creation. Captured here
  // (synchronously) so it isn't clobbered by other effects that re-persist
  // timer fields on first render.
  const mountSnapshotRef = useRef({
    isRunning: JSON.parse(localStorage.getItem('kronos_pomodoro_is_running') || 'false'),
    isPaused: JSON.parse(localStorage.getItem('kronos_pomodoro_is_paused') || 'false'),
    timeLeftAt: parseInt(localStorage.getItem('kronos_pomodoro_time_left_at') || '0', 10),
  });

  // If the page reloads while a timer is actively running, account for the
  // elapsed wall-clock time. Anything beyond this threshold is treated as
  // "tab abandoned" and triggers a reset (see mount effect below) rather than
  // silently inventing minutes/hours of work.
  const STALE_TIMER_THRESHOLD_SECONDS = 5 * 60;

  // Settings state
  const [workDuration, setWorkDuration] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_work_duration');
    return saved ? parseInt(saved) : 25;
  });
  
  const [shortBreakDuration, setShortBreakDuration] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_short_break_duration');
    return saved ? parseInt(saved) : 5;
  });
  
  const [longBreakDuration, setLongBreakDuration] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_long_break_duration');
    return saved ? parseInt(saved) : 15;
  });
  
  const [totalSets, setTotalSets] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_total_sets');
    return saved ? parseInt(saved) : 4;
  });
  
  const [autoStartBreaks, setAutoStartBreaks] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_auto_start_breaks');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [autoStartWork, setAutoStartWork] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_auto_start_work');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Timer state (persisted across tab switches)
  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_is_running');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const [isPaused, setIsPaused] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_is_paused');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const [currentPhase, setCurrentPhase] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_current_phase');
    return saved || 'work';
  });
  
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_time_left');
    const baseValue = saved ? parseInt(saved) : 25 * 60;

    // If a timer was actively running when the tab last closed, decrement by
    // the wall-clock time spent away. The mount effect below will hard-reset
    // if that elapsed time is past the stale threshold, so for the brief case
    // we just apply the catch-up here.
    const snap = mountSnapshotRef.current;
    if (!snap.isRunning || snap.isPaused || !snap.timeLeftAt) return baseValue;

    const elapsedSeconds = Math.floor((Date.now() - snap.timeLeftAt) / 1000);
    if (elapsedSeconds <= 1 || elapsedSeconds > STALE_TIMER_THRESHOLD_SECONDS) {
      return baseValue;
    }
    return Math.max(0, baseValue - elapsedSeconds);
  });
  
  const [currentSet, setCurrentSet] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_current_set');
    return saved ? parseInt(saved) : 1;
  });
  
  const [completedSets, setCompletedSets] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_completed_sets');
    return saved ? parseInt(saved) : 0;
  });
  
  const [currentTask, setCurrentTask] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_current_task');
    return saved || '';
  });
  
  const [isTrackingTask, setIsTrackingTask] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_is_tracking_task');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const [taskStartTime, setTaskStartTime] = useState(() => {
    const saved = localStorage.getItem('kronos_pomodoro_task_start_time');
    return saved ? new Date(saved) : null;
  });

  const intervalRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_work_duration', workDuration.toString());
  }, [workDuration]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_short_break_duration', shortBreakDuration.toString());
  }, [shortBreakDuration]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_long_break_duration', longBreakDuration.toString());
  }, [longBreakDuration]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_total_sets', totalSets.toString());
  }, [totalSets]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_auto_start_breaks', JSON.stringify(autoStartBreaks));
  }, [autoStartBreaks]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_auto_start_work', JSON.stringify(autoStartWork));
  }, [autoStartWork]);

  // Save timer state to localStorage
  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_is_running', JSON.stringify(isRunning));
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_is_paused', JSON.stringify(isPaused));
  }, [isPaused]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_current_phase', currentPhase);
  }, [currentPhase]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_time_left', timeLeft.toString());
    // Record when this value was written so a subsequent reload can detect
    // how long the tab was inactive and decide whether to catch up or reset.
    localStorage.setItem('kronos_pomodoro_time_left_at', Date.now().toString());
  }, [timeLeft]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_current_set', currentSet.toString());
  }, [currentSet]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_completed_sets', completedSets.toString());
  }, [completedSets]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_current_task', currentTask);
  }, [currentTask]);

  useEffect(() => {
    localStorage.setItem('kronos_pomodoro_is_tracking_task', JSON.stringify(isTrackingTask));
  }, [isTrackingTask]);

  useEffect(() => {
    if (taskStartTime) {
      localStorage.setItem('kronos_pomodoro_task_start_time', taskStartTime.toISOString());
    } else {
      localStorage.removeItem('kronos_pomodoro_task_start_time');
    }
  }, [taskStartTime]);

  // Timer countdown. The deps are `[isRunning, isPaused]` only — NOT `timeLeft`
  // — so the interval is created once per running session instead of being
  // torn down and recreated every second. The interval callback computes
  // elapsed seconds from a wall-clock anchor each tick, so throttled-tab
  // delays (where the browser fires once-per-minute instead of per-second)
  // catch up correctly: a 60-second-late fire decrements timeLeft by 60.
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastUpdateTimeRef.current = Date.now();
      return;
    }

    lastUpdateTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastUpdateTimeRef.current) / 1000);
      if (elapsedSeconds <= 0) return;
      lastUpdateTimeRef.current += elapsedSeconds * 1000;
      setTimeLeft(prev => Math.max(0, prev - elapsedSeconds));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  // When the tab becomes visible again, catch up immediately rather than
  // waiting for the next (possibly-throttled) interval fire. Same anchor
  // arithmetic as the interval body — exactly one decrement covers the
  // hidden-tab gap.
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastUpdateTimeRef.current) / 1000);
      if (elapsedSeconds <= 0) return;
      lastUpdateTimeRef.current += elapsedSeconds * 1000;
      setTimeLeft(prev => Math.max(0, prev - elapsedSeconds));
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isRunning, isPaused]);

  // Cleanup timer intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // If a running timer was persisted but the tab has been closed long enough
  // that the recorded session is no longer trustworthy, hard-reset rather than
  // resume — otherwise we'd silently invent hours of "work" on the next phase
  // completion (taskStartTime would still point at when the user originally
  // started, but endTime would be now).
  useEffect(() => {
    const snap = mountSnapshotRef.current;
    if (!snap.isRunning || snap.isPaused || !snap.timeLeftAt) return;

    const elapsedSeconds = Math.floor((Date.now() - snap.timeLeftAt) / 1000);
    if (elapsedSeconds <= STALE_TIMER_THRESHOLD_SECONDS) return;

    setIsRunning(false);
    setIsPaused(false);
    setIsTrackingTask(false);
    setTaskStartTime(null);

    let phaseDuration;
    switch (currentPhase) {
      case 'work': phaseDuration = workDuration * 60; break;
      case 'shortBreak': phaseDuration = shortBreakDuration * 60; break;
      case 'longBreak': phaseDuration = longBreakDuration * 60; break;
      default: phaseDuration = workDuration * 60;
    }
    setTimeLeft(phaseDuration);

    const minutes = Math.round(elapsedSeconds / 60);
    warning(`Pomodoro reset — tab was inactive for ${minutes} minute${minutes === 1 ? '' : 's'}`);
    // Mount-only: deps intentionally empty so this never re-runs as state evolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hold the latest handlePhaseComplete in a ref so the completion effect
  // doesn't have to depend on its identity. Without this, listing it in deps
  // would re-fire the effect every render (its useCallback deps churn), and
  // omitting it leaves an ESLint warning + risk of calling a stale closure.
  // The ref is sync'd in a useEffect declared AFTER handlePhaseComplete (a
  // const declaration further down) — placing it here would hit the temporal
  // dead zone for the deps array.
  const handlePhaseCompleteRef = useRef(null);

  // Single-fire guard. Even though the natural state flow only writes 0 to
  // timeLeft once per phase, React StrictMode double-invokes effects in dev
  // and a future code path could write 0 again before the new duration
  // propagates. Either case would record a duplicate entry without this.
  const completionHandledRef = useRef(false);

  // Handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && isRunning && !completionHandledRef.current) {
      completionHandledRef.current = true;
      handlePhaseCompleteRef.current?.();
    } else if (timeLeft > 0) {
      // Reset the guard once we've left the zero state — a future tick that
      // hits zero again is a legitimate new completion.
      completionHandledRef.current = false;
    }
  }, [timeLeft, isRunning]);

  const handlePhaseComplete = useCallback(() => {
    // Handle task tracking
    if (currentPhase === 'work' && isTrackingTask && currentTask) {
      // Save completed work session
      const endTime = new Date();
      const duration = workDuration * 60;

      // Use end - workDuration as the effective startTime instead of the
      // original taskStartTime. If the user paused mid-pomodoro, the wall
      // time between taskStartTime and endTime is longer than the actual
      // work, and downstream aggregators (weeklyTimesheet.js) would count
      // the pause as work. Trimming the start forward makes pauses appear
      // as gaps between entries — i.e. break time — which is what they are.
      const effectiveStart = new Date(endTime.getTime() - duration * 1000);

      // Create time entry for the completed work session using same structure as DailyTracker
      const timeEntry = {
        id: generateEntryId(),
        description: `${currentTask}`,
        startTime: effectiveStart.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        timezone: selectedTimezone,
        source: 'pomodoro'
      };

      // Get storage date key using timezone-aware logic (same as DailyTracker)
      const getStorageDateKey = (date) => {
        const dateInTimezone = toZonedTime(date, selectedTimezone);
        return format(dateInTimezone, 'yyyy-MM-dd');
      };

      const storageKey = getStorageDateKey(effectiveStart);

      // Save using the same storage system as DailyTracker
      const allData = loadTimesheetData() || {};
      if (!allData[storageKey]) {
        allData[storageKey] = [];
      }
      allData[storageKey].push(timeEntry);
      saveTimesheetData(allData);

      // Auto-save to weekly timesheet so the weekly view stays in sync
      // with timer-based completions everywhere else in the app.
      const { saved } = writeWeeklyTimesheetForDates([storageKey], selectedTimezone);
      if (saved.length > 0) {
        success(`Pomodoro session completed and auto-saved: ${currentTask}`);
      } else {
        success(`Pomodoro session completed: ${currentTask}`);
      }
    }

    // Move to next phase
    let nextPhase;
    if (currentPhase === 'work') {
      const newCompletedSets = completedSets + 1;
      setCompletedSets(newCompletedSets);
      
      if (newCompletedSets >= totalSets) {
        // Completed all sets
        nextPhase = 'longBreak';
        setCurrentPhase('longBreak');
        setTimeLeft(longBreakDuration * 60);
        success('Great job! You completed all pomodoro sets. Time for a long break!');
      } else {
        // Short break between sets
        nextPhase = 'shortBreak';
        setCurrentPhase('shortBreak');
        setTimeLeft(shortBreakDuration * 60);
        success(`Set ${currentSet} completed! Time for a short break.`);
      }
    } else {
      // Break completed, back to work
      if (currentPhase === 'shortBreak') {
        setCurrentSet(currentSet + 1);
      } else if (currentPhase === 'longBreak') {
        // Reset sets after long break
        // Clear localStorage to ensure reset takes effect
        setCurrentSet(1);
        setCompletedSets(0);
      }
      nextPhase = 'work';
      setCurrentPhase('work');
      setTimeLeft(workDuration * 60); // Explicitly set work duration
      
      // Update task start time for new work session
      if (isTrackingTask && currentTask) {
        setTaskStartTime(new Date());
      }
      
      if (autoStartWork) {
        setIsRunning(true);
        setIsPaused(false);
      } else {
        setIsRunning(false);
        setIsPaused(false);
      }
    }

    // Auto-start next phase if enabled
    if ((nextPhase === 'shortBreak' || nextPhase === 'longBreak') && autoStartBreaks) {
      setIsRunning(true);
      setIsPaused(false);
    } else if (nextPhase === 'work' && !autoStartWork) {
      setIsRunning(false);
      setIsPaused(false);
    }
  }, [currentPhase, currentSet, totalSets, completedSets, isTrackingTask, currentTask, taskStartTime, selectedTimezone, autoStartBreaks, autoStartWork, workDuration, shortBreakDuration, longBreakDuration, success]);

  // Sync the ref to the latest handlePhaseComplete. Declared here (after
  // the useCallback above) to avoid a temporal-dead-zone error on the deps
  // array if it were placed earlier.
  useEffect(() => {
    handlePhaseCompleteRef.current = handlePhaseComplete;
  }, [handlePhaseComplete]);

  // Update total time when phase or settings change
  useEffect(() => {
    let duration;
    switch (currentPhase) {
      case 'work':
        duration = workDuration * 60;
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
    
    // Only update timeLeft if timer is not running
    if (!isRunning && !isPaused) {
      setTimeLeft(duration);
    }
  }, [currentPhase, workDuration, shortBreakDuration, longBreakDuration, isRunning, isPaused]);

  const startTimer = () => {
    lastUpdateTimeRef.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseTimer = () => {
    setIsPaused(true);
  };

  const resumeTimer = () => {
    lastUpdateTimeRef.current = Date.now();
    setIsPaused(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsTrackingTask(false);
    setTaskStartTime(null);
    
    let duration;
    switch (currentPhase) {
      case 'work':
        duration = workDuration * 60;
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
    setTimeLeft(duration);
  };

  const skipPhase = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsTrackingTask(false);
    setTaskStartTime(null);
    
    if (currentPhase === 'work') {
      setCurrentPhase('shortBreak');
    } else if (currentPhase === 'shortBreak') {
      setCurrentPhase('work');
      setCurrentSet(prev => prev + 1);
    } else if (currentPhase === 'longBreak') {
      setCurrentPhase('work');
      setCurrentSet(1);
      setCompletedSets(0);
    }
  };

  const resetAll = () => {
    setIsRunning(false);
    setIsPaused(false);
    setIsTrackingTask(false);
    setTaskStartTime(null);
    setCurrentPhase('work');
    setCurrentSet(1);
    setCompletedSets(0);
    setTimeLeft(workDuration * 60);
    setCurrentTask('');
  };

  const startTaskTracking = (task) => {
    setCurrentTask(task);
    setIsTrackingTask(true);
    setTaskStartTime(new Date());
  };

  const stopTaskTracking = () => {
    setIsTrackingTask(false);
    setTaskStartTime(null);
  };

  const value = {
    // Settings
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
    completedSets,
    currentTask,
    isTrackingTask,
    taskStartTime,
    selectedTimezone,

    // Timer actions
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipPhase,
    resetAll,
    startTaskTracking,
    stopTaskTracking,
    
    // Phase setters
    setCurrentPhase,
    setCurrentSet,
    setCompletedSets,
    setCurrentTask,
    setIsTrackingTask,
    setTaskStartTime
  };

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
};
