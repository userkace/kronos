import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadWeekStart, saveWeekStart, loadClockFormat, saveClockFormat } from '../utils/storage';

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
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedWeekStart = loadWeekStart();
    const savedClockFormat = loadClockFormat();
    console.log('=== UserPreferencesContext Load ===');
    console.log('Loaded week start from storage:', savedWeekStart);
    console.log('Loaded clock format from storage:', savedClockFormat);
    setWeekStart(savedWeekStart);
    setClockFormat(savedClockFormat);
    setIsInitialized(true);
  }, []);

  // Save week start to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('=== UserPreferencesContext Save Week Start ===');
      console.log('Saving week start to storage:', weekStart);
      saveWeekStart(weekStart);
    }
  }, [weekStart, isInitialized]);

  // Save clock format to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('=== UserPreferencesContext Save Clock Format ===');
      console.log('Saving clock format to storage:', clockFormat);
      saveClockFormat(clockFormat);
    }
  }, [clockFormat, isInitialized]);

  const changeWeekStart = (newWeekStart) => {
    console.log('=== UserPreferencesContext Change Week Start ===');
    console.log('Changing week start from', weekStart, 'to', newWeekStart);
    setWeekStart(newWeekStart);
  };

  const changeClockFormat = (newClockFormat) => {
    console.log('=== UserPreferencesContext Change Clock Format ===');
    console.log('Changing clock format from', clockFormat, 'to', newClockFormat);
    setClockFormat(newClockFormat);
  };

  const value = {
    weekStart,
    changeWeekStart,
    clockFormat,
    changeClockFormat,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
