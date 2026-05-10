import React, { useState, useRef, useEffect } from 'react';
import TimezoneSelect from './TimezoneSelect';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import {
  clearAllData,
  getCorruptionBackupsDetailed,
  getQuarantineRaw,
  restoreFromQuarantine,
  discardQuarantine,
} from '../utils/storage';
import {
  Globe, Calendar, Clock, RotateCcw, Trash2, Settings as SettingsIcon,
  AlertTriangle, Download, RefreshCcw, X, Target
} from 'lucide-react';

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const Settings = ({ onCorruptionResolved }) => {
  const { selectedTimezone, changeTimezone } = useTimezone();
  const {
    weekStart, changeWeekStart,
    clockFormat, changeClockFormat,
    dailyHourGoal, changeDailyHourGoal,
    weekendDays, changeWeekendDays
  } = useUserPreferences();
  const { success, error, warning } = useToast();
  const [backups, setBackups] = useState(() => getCorruptionBackupsDetailed());

  const refreshBackups = () => {
    setBackups(getCorruptionBackupsDetailed());
    if (onCorruptionResolved) onCorruptionResolved();
  };

  const handleDownloadBackup = (backup) => {
    const raw = getQuarantineRaw(backup.backupKey);
    if (raw == null) {
      error('Backup contents could not be read');
      return;
    }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${backup.backupKey}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Backup downloaded');
  };

  const handleRestoreBackup = (backup) => {
    if (!window.confirm(
      `Restore "${backup.originalKey}" from this backup?\n\n` +
      `The current value (defaulted after the failed load) will be replaced ` +
      `with the quarantined contents. The backup will then be removed.`
    )) return;
    const ok = restoreFromQuarantine(backup.backupKey);
    if (ok) {
      success(`Restored ${backup.originalKey} — reloading…`);
      // A reload is the cleanest way to ensure all in-memory state reflects
      // the freshly-restored value rather than the previously-defaulted one.
      setTimeout(() => window.location.reload(), 800);
    } else {
      error('Restore failed: backup is still unparseable. Try Download to inspect manually.');
    }
  };

  const handleDiscardBackup = (backup) => {
    if (!window.confirm(
      `Discard the backup for "${backup.originalKey}"?\n\n` +
      `The quarantined data will be permanently deleted and the app will ` +
      `continue with empty defaults for this key. This cannot be undone.`
    )) return;
    discardQuarantine(backup.backupKey);
    refreshBackups();
    warning('Backup discarded');
  };

  const [timezone, setTimezone] = useState(selectedTimezone);
  const [weekStartValue, setWeekStartValue] = useState(weekStart);
  const [clockFormatValue, setClockFormatValue] = useState(clockFormat);
  const [dailyHourGoalValue, setDailyHourGoalValue] = useState(String(dailyHourGoal));
  const [weekendDaysValue, setWeekendDaysValue] = useState(weekendDays);
  const [isResetting, setIsResetting] = useState(false);
  const reloadTimeoutRef = useRef(null);

  // Pull updates from context (e.g. when an outside save changes the goal)
  // so the local input doesn't go stale.
  useEffect(() => {
    setDailyHourGoalValue(String(dailyHourGoal));
  }, [dailyHourGoal]);

  useEffect(() => {
    setWeekendDaysValue(weekendDays);
  }, [weekendDays]);

  const toggleWeekendDay = (idx) => {
    setWeekendDaysValue(prev =>
      prev.includes(idx)
        ? prev.filter(d => d !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleTimezoneChange = (newTimezone) => {
    setTimezone(newTimezone);
  };

  const handleWeekStartChange = (newWeekStart) => {
    setWeekStartValue(newWeekStart);
  };

  const handleClockFormatChange = (newClockFormat) => {
    setClockFormatValue(newClockFormat);
  };

  const handleDailyHourGoalChange = (raw) => {
    setDailyHourGoalValue(raw);
  };

  const handleSaveSettings = () => {
    try {
      changeTimezone(timezone);
      changeWeekStart(weekStartValue);
      changeClockFormat(clockFormatValue);
      const parsedGoal = Number(dailyHourGoalValue);
      if (!Number.isFinite(parsedGoal) || parsedGoal <= 0 || parsedGoal > 24) {
        error('Daily hour goal must be between 0 and 24');
        return;
      }
      changeDailyHourGoal(parsedGoal);
      changeWeekendDays(weekendDaysValue);
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
          if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
          }
          reloadTimeoutRef.current = setTimeout(() => {
            window.location.reload();
          }, 3000);
        } catch (err) {
          setIsResetting(false);
          error('Failed to clear data');
        }
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 m-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>

      <div className="space-y-6">
        {/* Data Recovery — only rendered when there are quarantined backups. */}
        {backups.length > 0 && (
          <div className="border-2 border-amber-300 rounded-lg p-4 bg-amber-50">
            <div className="flex items-center space-x-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-amber-900">Data Recovery</h4>
            </div>
            <p className="text-sm text-amber-800 mb-4">
              The data below could not be parsed on the last load. Saves to these
              keys are paused until you decide what to do. Choose Restore to
              re-import the backup, Download to inspect it manually, or Discard
              to permanently delete it and start fresh.
            </p>

            <div className="space-y-3">
              {backups.map(backup => (
                <div
                  key={backup.backupKey}
                  className="bg-white border border-amber-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-gray-900 break-all">
                        {backup.originalKey}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {backup.timestamp
                          ? `Quarantined ${backup.timestamp} UTC · `
                          : ''}
                        {formatBytes(backup.sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleDownloadBackup(backup)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(backup)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDiscardBackup(backup)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Non-Work Days */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Non-Work Days</h4>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, idx) => {
                const isSelected = weekendDaysValue.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleWeekendDay(idx)}
                    aria-pressed={isSelected}
                    className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-500">
              Days you don't normally work. Skipping these won't break your streak on the Reports view.
            </p>
          </div>
        </div>

        {/* Daily Hour Goal */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Target className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Daily Hour Goal</h4>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="dailyHourGoal" className="block text-sm font-medium text-gray-700 mb-2">
                Hours per day
              </label>
              <input
                id="dailyHourGoal"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={dailyHourGoalValue}
                onChange={(e) => handleDailyHourGoalChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Target tracked hours per day. Drives the goal ring on the Reports view.
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
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">Save Changes</h4>
                <p className="text-sm text-blue-700">Apply your updated settings</p>
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>

        {/* Reset Options */}


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
                className="px-4 py-2 bg-yellow-600/80 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
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
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Clearing...' : 'Clear All'}</span>
              </button>
            </div>
          </div>

      </div>
    </div>
  );
};

export default Settings;
