import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loadWeekStart,
  saveWeekStart,
  loadClockFormat,
  saveClockFormat,
  loadDateFormat,
  saveDateFormat,
  loadSortOrder,
  saveSortOrder,
  loadShowBreaks,
  saveShowBreaks,
  loadDailyHourGoal,
  saveDailyHourGoal,
  loadWeekendDays,
  saveWeekendDays,
  loadHeatmapColors,
  saveHeatmapColors,
  DEFAULT_HEATMAP_COLORS,
  loadGoalRingColors,
  saveGoalRingColors,
  DEFAULT_GOAL_RING_COLORS,
} from '../utils/storage';

const UserPreferencesContext = createContext();

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

export const UserPreferencesProvider = ({ children }) => {
  const [weekStart, setWeekStart] = useState('sunday');
  const [clockFormat, setClockFormat] = useState('12hour');
  const [dateFormat, setDateFormat] = useState('short');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showBreaks, setShowBreaks] = useState(true);
  const [dailyHourGoal, setDailyHourGoal] = useState(8);
  const [weekendDays, setWeekendDays] = useState([0, 6]);
  const [heatmapColors, setHeatmapColors] = useState(DEFAULT_HEATMAP_COLORS);
  const [goalRingColors, setGoalRingColors] = useState(DEFAULT_GOAL_RING_COLORS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setWeekStart(loadWeekStart());
    setClockFormat(loadClockFormat());
    setDateFormat(loadDateFormat());
    setSortOrder(loadSortOrder());
    setShowBreaks(loadShowBreaks());
    setDailyHourGoal(loadDailyHourGoal());
    setWeekendDays(loadWeekendDays());
    setHeatmapColors(loadHeatmapColors());
    setGoalRingColors(loadGoalRingColors());
    setIsInitialized(true);
  }, []);

  // Save week start to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveWeekStart(weekStart);
  }, [weekStart, isInitialized]);

  // Save clock format to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveClockFormat(clockFormat);
  }, [clockFormat, isInitialized]);

  useEffect(() => {
    if (isInitialized) saveDateFormat(dateFormat);
  }, [dateFormat, isInitialized]);

  // Save sort order to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveSortOrder(sortOrder);
  }, [sortOrder, isInitialized]);

  // Save show breaks preference to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveShowBreaks(showBreaks);
  }, [showBreaks, isInitialized]);

  // Save daily hour goal to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveDailyHourGoal(dailyHourGoal);
  }, [dailyHourGoal, isInitialized]);

  // Save weekend days to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveWeekendDays(weekendDays);
  }, [weekendDays, isInitialized]);

  // Save heatmap colors to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (isInitialized) saveHeatmapColors(heatmapColors);
  }, [heatmapColors, isInitialized]);

  useEffect(() => {
    if (isInitialized) saveGoalRingColors(goalRingColors);
  }, [goalRingColors, isInitialized]);

  const changeWeekStart = (newWeekStart) => setWeekStart(newWeekStart);
  const changeClockFormat = (newClockFormat) => setClockFormat(newClockFormat);
  const changeDateFormat = (newDateFormat) => setDateFormat(newDateFormat);
  const changeSortOrder = (newSortOrder) => setSortOrder(newSortOrder);
  const toggleShowBreaks = () => setShowBreaks(prev => !prev);
  const changeDailyHourGoal = (hours) => {
    const n = Number(hours);
    if (Number.isFinite(n) && n > 0) setDailyHourGoal(n);
  };
  const changeHeatmapColors = (colors) => setHeatmapColors(colors);
  const changeGoalRingColors = (colors) => setGoalRingColors(colors);

  const changeWeekendDays = (days) => {
    if (!Array.isArray(days)) return;
    const cleaned = Array.from(new Set(
      days
        .map(Number)
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    )).sort((a, b) => a - b);
    setWeekendDays(cleaned);
  };

  const value = {
    weekStart,
    changeWeekStart,
    clockFormat,
    changeClockFormat,
    dateFormat,
    changeDateFormat,
    sortOrder,
    changeSortOrder,
    showBreaks,
    toggleShowBreaks,
    dailyHourGoal,
    changeDailyHourGoal,
    weekendDays,
    changeWeekendDays,
    heatmapColors,
    changeHeatmapColors,
    goalRingColors,
    changeGoalRingColors,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
