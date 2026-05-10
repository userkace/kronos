import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loadWeekStart,
  saveWeekStart,
  loadClockFormat,
  saveClockFormat,
  loadSortOrder,
  saveSortOrder,
  loadShowBreaks,
  saveShowBreaks,
  loadDailyHourGoal,
  saveDailyHourGoal
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
  const [sortOrder, setSortOrder] = useState('desc');
  const [showBreaks, setShowBreaks] = useState(true);
  const [dailyHourGoal, setDailyHourGoal] = useState(8);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setWeekStart(loadWeekStart());
    setClockFormat(loadClockFormat());
    setSortOrder(loadSortOrder());
    setShowBreaks(loadShowBreaks());
    setDailyHourGoal(loadDailyHourGoal());
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

  const changeWeekStart = (newWeekStart) => setWeekStart(newWeekStart);
  const changeClockFormat = (newClockFormat) => setClockFormat(newClockFormat);
  const changeSortOrder = (newSortOrder) => setSortOrder(newSortOrder);
  const toggleShowBreaks = () => setShowBreaks(prev => !prev);
  const changeDailyHourGoal = (hours) => {
    const n = Number(hours);
    if (Number.isFinite(n) && n > 0) setDailyHourGoal(n);
  };

  const value = {
    weekStart,
    changeWeekStart,
    clockFormat,
    changeClockFormat,
    sortOrder,
    changeSortOrder,
    showBreaks,
    toggleShowBreaks,
    dailyHourGoal,
    changeDailyHourGoal,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
