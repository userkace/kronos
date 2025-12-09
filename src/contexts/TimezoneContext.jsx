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
    console.log('=== TimezoneContext Debug ===');
    console.log('Loaded timezone from storage:', savedTimezone);
    if (savedTimezone) {
      setSelectedTimezone(savedTimezone);
      console.log('Set timezone to:', savedTimezone);
    } else {
      // No timezone saved, keep default UTC
      console.log('No saved timezone, using default UTC');
    }
    setIsInitialized(true);
  }, []);

  // Save timezone to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log('Saving timezone to storage:', selectedTimezone);
      saveTimezone(selectedTimezone);
    }
  }, [selectedTimezone, isInitialized]);

  const changeTimezone = (timezone) => {
    console.log('Changing timezone from', selectedTimezone, 'to', timezone);
    setSelectedTimezone(timezone);
  };

  const value = {
    selectedTimezone,
    changeTimezone,
  };

  console.log('TimezoneContext current value:', value);

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
};

export default TimezoneContext;
