import React, { useState } from 'react';
import TimezoneSelect from './TimezoneSelect';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import { 
  saveOnboardingCompleted, 
  clearAllData 
} from '../utils/storage';

const Settings = () => {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { weekStart, changeWeekStart } = useUserPreferences();
  const { success, error, warning } = useToast();
  
  const [timezone, setTimezone] = useState(selectedTimezone);
  const [weekStartValue, setWeekStartValue] = useState(weekStart);
  const [isResetting, setIsResetting] = useState(false);

  const handleTimezoneChange = (newTimezone) => {
    setTimezone(newTimezone);
  };

  const handleWeekStartChange = (newWeekStart) => {
    setWeekStartValue(newWeekStart);
  };

  const handleSaveSettings = () => {
    try {
      changeTimezone(timezone);
      changeWeekStart(weekStartValue);
      success('Settings saved successfully!');
    } catch (err) {
      error('Failed to save settings');
    }
  };

  const handleResetOnboarding = () => {
    if (window.confirm('Are you sure you want to reset onboarding? This will show the setup screen again next time you start the app.')) {
      try {
        // Clear onboarding completion flag
        localStorage.removeItem('kronos_onboarding_completed');
        success('Onboarding reset. The setup screen will appear on next app restart.');
      } catch (err) {
        error('Failed to reset onboarding');
      }
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to clear all data? This will delete all your timesheet entries and cannot be undone.')) {
      if (window.confirm('This action is permanent. Are you absolutely sure?')) {
        try {
          setIsResetting(true);
          clearAllData();
          warning('All data cleared. The app will reload in 3 seconds...');
          
          // Reload the page after clearing data
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } catch (err) {
          setIsResetting(false);
          error('Failed to clear data');
        }
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your application preferences</p>
        </div>

        <div className="p-6 space-y-8">
          {/* Timezone Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timezone</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Timezone
                </label>
                <TimezoneSelect
                  timezone={timezone}
                  onTimezoneChange={handleTimezoneChange}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Select your local timezone for accurate time tracking
                </p>
              </div>
            </div>
          </div>

          {/* Week Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Week Settings</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="weekStart" className="block text-sm font-medium text-gray-700 mb-2">
                  Start of the Week
                </label>
                <select
                  id="weekStart"
                  value={weekStartValue}
                  onChange={(e) => handleWeekStartChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose which day your week starts on
                </p>
              </div>
            </div>
          </div>

          {/* Save Settings Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Save Settings
            </button>
          </div>

          {/* Reset Options */}
          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset Options</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">Reset Onboarding</h3>
                  <p className="text-sm text-gray-600">Show the setup screen again on next app start</p>
                </div>
                <button
                  onClick={handleResetOnboarding}
                  className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-red-900">Clear All Data</h3>
                  <p className="text-sm text-red-600">Delete all timesheet entries and reset app</p>
                </div>
                <button
                  onClick={handleClearAllData}
                  disabled={isResetting}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Clearing...' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
