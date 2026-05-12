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
  DEFAULT_HEATMAP_COLORS,
} from '../utils/storage';
import {
  Globe, Calendar, Clock, RotateCcw, Trash2, Settings as SettingsIcon,
  AlertTriangle, Download, RefreshCcw, X, BarChart2, Plus,
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
    weekendDays, changeWeekendDays,
    heatmapColors, changeHeatmapColors,
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
  const [heatmapColorsEdit, setHeatmapColorsEdit] = useState(() =>
    JSON.parse(JSON.stringify(heatmapColors))
  );
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
    <div className="p-6 max-w-4xl mx-auto">
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

        {/* Work Schedule — week start, non-work days, and daily hour goal */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Work Schedule</h4>
          </div>

          <div className="space-y-5">
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
                Choose which day your week starts on.
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Non-Work Days
              </label>
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
              <p className="mt-2 text-sm text-gray-500">
                Days you don't normally work. Skipping these won't break your streak on the Reports view.
              </p>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label htmlFor="dailyHourGoal" className="block text-sm font-medium text-gray-700 mb-2">
                Daily Hours Goal
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

        {/* Heatmap Colors */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Heatmap Colors</h4>
          </div>

          <div className="space-y-4">
            {/* Live preview */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span>Less</span>
              <div className="w-4 h-4 rounded-sm border border-gray-200" style={{ backgroundColor: heatmapColorsEdit.emptyColor }} />
              {[...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo).map((stop, i) => (
                <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: stop.color }} />
              ))}
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: heatmapColorsEdit.completionColor }} />
              <span>Goal met</span>
            </div>

            {/* Color stops */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Progress Stops</p>
              <div className="space-y-2">
                {(() => {
                  const sorted = [...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo);
                  return sorted.map((stop, i) => {
                    const prevUpTo = i === 0 ? 0 : sorted[i - 1].upTo;
                    const nextUpTo = i < sorted.length - 1 ? sorted[i + 1].upTo : 101;
                    const isLast = i === sorted.length - 1;

                    const updateStop = (patch) => {
                      const newStops = sorted.map((s, j) => j === i ? { ...s, ...patch } : s);
                      const updated = { ...heatmapColorsEdit, stops: newStops };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    };

                    const removeStop = () => {
                      const newStops = sorted.filter((_, j) => j !== i);
                      const updated = { ...heatmapColorsEdit, stops: newStops };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    };

                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={stop.color}
                          onChange={(e) => updateStop({ color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5 shrink-0"
                          title="Pick color"
                        />
                        <span className="text-xs text-gray-400 w-7 text-right shrink-0">{prevUpTo}%</span>
                        <span className="text-xs text-gray-300 shrink-0">–</span>
                        {isLast ? (
                          <span className="text-xs text-gray-500">100% <span className="text-gray-400">(below goal)</span></span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={prevUpTo + 1}
                              max={nextUpTo - 1}
                              value={stop.upTo}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (Number.isInteger(v) && v > prevUpTo && v < nextUpTo) {
                                  updateStop({ upTo: v });
                                }
                              }}
                              className="w-14 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        )}
                        {!isLast && (
                          <button
                            onClick={removeStop}
                            className="ml-auto text-gray-300 hover:text-red-400 transition-colors"
                            title="Remove stop"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <button
                onClick={() => {
                  const sorted = [...heatmapColorsEdit.stops].sort((a, b) => a.upTo - b.upTo);
                  const last = sorted[sorted.length - 1];
                  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : { upTo: 0 };
                  const newUpTo = Math.floor((prev.upTo + 100) / 2);
                  const newStop = { upTo: newUpTo, color: last.color };
                  const newStops = [...sorted.slice(0, -1), newStop, last];
                  const updated = { ...heatmapColorsEdit, stops: newStops };
                  setHeatmapColorsEdit(updated);
                  changeHeatmapColors(updated);
                }}
                className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add stop
              </button>
            </div>

            {/* Completion & empty colors */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Goal met (≥ 100%)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heatmapColorsEdit.completionColor}
                    onChange={(e) => {
                      const updated = { ...heatmapColorsEdit, completionColor: e.target.value };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    }}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{heatmapColorsEdit.completionColor}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">No time tracked</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={heatmapColorsEdit.emptyColor}
                    onChange={(e) => {
                      const updated = { ...heatmapColorsEdit, emptyColor: e.target.value };
                      setHeatmapColorsEdit(updated);
                      changeHeatmapColors(updated);
                    }}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5 shrink-0"
                  />
                  <span className="text-xs text-gray-500 font-mono">{heatmapColorsEdit.emptyColor}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400">Changes apply immediately to the Reports view.</p>
              <button
                onClick={() => {
                  const defaults = JSON.parse(JSON.stringify(DEFAULT_HEATMAP_COLORS));
                  setHeatmapColorsEdit(defaults);
                  changeHeatmapColors(defaults);
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to default
              </button>
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
    </div>
  );
};

export default Settings;
