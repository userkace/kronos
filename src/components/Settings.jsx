import React, { useState } from 'react';
import TimezoneSelect from './TimezoneSelect';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import {
  saveOnboardingCompleted,
  clearAllData
} from '../utils/storage';
import { Globe, Calendar, Clock, RotateCcw, Trash2, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { weekStart, changeWeekStart, clockFormat, changeClockFormat } = useUserPreferences();
  const { success, error, warning } = useToast();

  const [timezone, setTimezone] = useState(selectedTimezone);
  const [weekStartValue, setWeekStartValue] = useState(weekStart);
  const [clockFormatValue, setClockFormatValue] = useState(clockFormat);
  const [isResetting, setIsResetting] = useState(false);

  const handleTimezoneChange = (newTimezone) => {
    setTimezone(newTimezone);
  };

  const handleWeekStartChange = (newWeekStart) => {
    setWeekStartValue(newWeekStart);
  };

  const handleClockFormatChange = (newClockFormat) => {
    setClockFormatValue(newClockFormat);
  };

  const handleSaveSettings = () => {
    try {
      changeTimezone(timezone);
      changeWeekStart(weekStartValue);
      changeClockFormat(clockFormatValue);
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 m-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>

      <div className="space-y-6">
        {/* Timezone Settings */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Globe className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Timezone Settings</h4>
          </div>

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
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Week Settings</h4>
          </div>

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

        {/* Clock Format Settings */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Clock Format</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="clockFormat" className="block text-sm font-medium text-gray-700 mb-2">
                Clock Display Format
              </label>
              <select
                id="clockFormat"
                value={clockFormatValue}
                onChange={(e) => handleClockFormatChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="12hour">12-hour (AM/PM)</option>
                <option value="24hour">24-hour</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Choose how time is displayed in the navigation bar
              </p>
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>

        {/* Reset Options */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <SettingsIcon className="w-5 h-5 text-orange-600" />
            <h4 className="font-medium text-gray-900">Reset Options</h4>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <RotateCcw className="w-5 h-5 text-yellow-600" />
                <div>
                  <h5 className="font-medium text-yellow-900">Reset Onboarding</h5>
                  <p className="text-sm text-yellow-700">Show the setup screen again on next app start</p>
                </div>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <div>
                  <h5 className="font-medium text-red-900">Clear All Data</h5>
                  <p className="text-sm text-red-700">Delete all timesheet entries and reset app</p>
                </div>
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
  );
};

export default Settings;
