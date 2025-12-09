import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadWeekStart, saveWeekStart } from '../utils/storage';

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
  const [isInitialized, setIsInitialized] = useState(false);

  // Load week start from localStorage on mount
  useEffect(() => {
    const savedWeekStart = loadWeekStart();
    console.log('=== UserPreferencesContext Load ===');
    console.log('Loaded week start from storage:', savedWeekStart);
    setWeekStart(savedWeekStart);
    setIsInitialized(true);
  }, []);

  // Save week start to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('=== UserPreferencesContext Save ===');
      console.log('Saving week start to storage:', weekStart);
      saveWeekStart(weekStart);
    }
  }, [weekStart, isInitialized]);

  const changeWeekStart = (newWeekStart) => {
    console.log('=== UserPreferencesContext Change ===');
    console.log('Changing week start from', weekStart, 'to', newWeekStart);
    setWeekStart(newWeekStart);
  };

  const value = {
    weekStart,
    changeWeekStart,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
