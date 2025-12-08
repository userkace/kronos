import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTimezone, saveTimezone } from '../utils/storage';

const TimezoneContext = createContext();

export const useTimezone = () => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};

export const TimezoneProvider = ({ children }) => {
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load timezone from localStorage on mount
  useEffect(() => {
    const savedTimezone = loadTimezone();
    if (savedTimezone) {
      setSelectedTimezone(savedTimezone);
    }
    setIsInitialized(true);
  }, []);

  // Save timezone to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      saveTimezone(selectedTimezone);
    }
  }, [selectedTimezone, isInitialized]);

  const changeTimezone = (timezone) => {
    setSelectedTimezone(timezone);
  };

  const value = {
    selectedTimezone,
    changeTimezone,
  };

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};

export default TimezoneContext;
