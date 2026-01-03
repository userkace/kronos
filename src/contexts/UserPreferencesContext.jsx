import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  loadWeekStart, 
  saveWeekStart, 
  loadClockFormat, 
  saveClockFormat, 
  loadSortOrder, 
  saveSortOrder,
  loadShowBreaks,
  saveShowBreaks 
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedWeekStart = loadWeekStart();
    const savedClockFormat = loadClockFormat();
    const savedSortOrder = loadSortOrder();
    const savedShowBreaks = loadShowBreaks();
    console.log('=== UserPreferencesContext Load ===');
    console.log('Loaded week start from storage:', savedWeekStart);
    console.log('Loaded clock format from storage:', savedClockFormat);
    console.log('Loaded sort order from storage:', savedSortOrder);
    console.log('Loaded show breaks from storage:', savedShowBreaks);
    setWeekStart(savedWeekStart);
    setClockFormat(savedClockFormat);
    setSortOrder(savedSortOrder);
    setShowBreaks(savedShowBreaks);
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

  // Save sort order to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('=== UserPreferencesContext Save Sort Order ===');
      console.log('Saving sort order to storage:', sortOrder);
      saveSortOrder(sortOrder);
    }
  }, [sortOrder, isInitialized]);

  // Save show breaks preference to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('=== UserPreferencesContext Save Show Breaks ===');
      console.log('Saving show breaks to storage:', showBreaks);
      saveShowBreaks(showBreaks);
    }
  }, [showBreaks, isInitialized]);

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

  const changeSortOrder = (newSortOrder) => {
    console.log('=== UserPreferencesContext Change Sort Order ===');
    console.log('Changing sort order from', sortOrder, 'to', newSortOrder);
    setSortOrder(newSortOrder);
  };

  const toggleShowBreaks = () => {
    console.log('=== UserPreferencesContext Toggle Show Breaks ===');
    console.log('Toggling show breaks from', showBreaks, 'to', !showBreaks);
    setShowBreaks(prev => !prev);
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
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
