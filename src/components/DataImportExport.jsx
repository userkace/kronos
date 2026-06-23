import React, { useState, useEffect } from 'react';
import { Download, Upload, RotateCcw, Trash2, FileText, AlertTriangle, Calendar, Clock, CheckSquare } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import {
  exportTimesheetData,
  importTimesheetData,
  importTimesheetDataSelective,
  revertImport,
  hasImportBackup,
  clearAllData
} from '../utils/dataImportExport';
import { loadTimesheetData, loadWeeklyTimesheet, loadTimezone } from '../utils/storage';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const DataImportExport = ({ onImportSuccess }) => {
  const { success, error, warning } = useToast();
  const { weekStart } = useUserPreferences();
  const [isImporting, setIsImporting] = useState(false);
  const [importInfo, setImportInfo] = useState(null);
  const [showRevertOption, setShowRevertOption] = useState(false);
  useEffect(() => { hasImportBackup().then(setShowRevertOption); }, []);

  // Advanced export states
  const [exportMode, setExportMode] = useState('all'); // 'all', 'days', 'weeks'
  const [availableDays, setAvailableDays] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);

  // Import mode states
  const [importMode, setImportMode] = useState('all'); // 'all', 'days', 'weeks'
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);

  // Load available data for selection
  useEffect(() => {
    const loadData = () => {
      const dailyData = loadTimesheetData() || {};
      const weeklyData = loadWeeklyTimesheet() || {};

      // Get available days with data
      const days = Object.keys(dailyData || {})
        .filter(date => dailyData[date] && dailyData[date].length > 0)
        .sort()
        .map(date => ({
          date,
          entries: dailyData[date].length,
          formatted: format(parseISO(date), 'MMM d, yyyy')
        }));

      // Get available weeks with data
      const weeks = Object.keys(weeklyData || {})
        .filter(weekKey => {
          const weekData = weeklyData[weekKey];
          return weekData && Object.keys(weekData).some(day => weekData[day].tasks || weekData[day].workDetails);
        })
        .sort()
        .map(weekKey => {
          const [year, weekNum] = weekKey.split('-W');
          const weekStartsOn = weekStart === 'sunday' ? 0 : 1;
          const weekStart = startOfWeek(new Date(year, 0, (weekNum - 1) * 7 + 1), { weekStartsOn });
          const weekEnd = endOfWeek(weekStart, { weekStartsOn });

          return {
            weekKey,
            weekNum: parseInt(weekNum),
            year: parseInt(year),
            start: format(weekStart, 'MMM d'),
            end: format(weekEnd, 'MMM d, yyyy'),
            formatted: `Week ${weekNum} (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`
          };
        });

      setAvailableDays(days);
      setAvailableWeeks(weeks);
    };

    loadData();
  }, []);

  const handleAdvancedExport = () => {
    try {
      const dailyData = loadTimesheetData() || {};
      const weeklyData = loadWeeklyTimesheet() || {};
      const timezone = loadTimezone();

      let exportData = {
        timezone: timezone || 'UTC',
        exportDate: new Date().toISOString(),
        version: '1.0',
        exportMode
      };

      if (exportMode === 'all') {
        exportData.dailyData = dailyData;
        exportData.weeklyData = weeklyData;
      } else if (exportMode === 'days') {
        const filteredDailyData = {};
        selectedDays.forEach(date => {
          if (dailyData[date]) {
            filteredDailyData[date] = dailyData[date];
          }
        });
        exportData.dailyData = filteredDailyData;
        exportData.weeklyData = {};
      } else if (exportMode === 'weeks') {
        const filteredWeeklyData = {};
        selectedWeeks.forEach(weekKey => {
          if (weeklyData[weekKey]) {
            filteredWeeklyData[weekKey] = weeklyData[weekKey];
          }
        });
        exportData.dailyData = {};
        exportData.weeklyData = filteredWeeklyData;
      }

      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const filename = exportMode === 'all'
        ? `timesheet-backup-${new Date().toISOString().split('T')[0]}.json`
        : exportMode === 'days'
        ? `timesheet-days-${selectedDays.length}-${new Date().toISOString().split('T')[0]}.json`
        : `timesheet-weeks-${selectedWeeks.length}-${new Date().toISOString().split('T')[0]}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success(`Exported ${exportMode === 'all' ? 'all data' : exportMode} successfully!`);
    } catch (error) {
      error('Export failed: ' + error.message);
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      error('Please select a valid JSON backup file');
      return;
    }

    setIsImporting(true);
    setImportInfo(null);

    // Use selective import based on mode
    const importFunction = importMode === 'all' ? importTimesheetData : importTimesheetDataSelective;
    const importParams = importMode === 'all' ? [file] : [file, importMode];

    importFunction(...importParams)
      .then((result) => {
        setIsImporting(false);
        setImportInfo(result.imported);
        setShowRevertOption(true);
        success(result.message);

        // Trigger app refresh
        if (onImportSuccess) {
          onImportSuccess();
        }

        // Reset file input
        event.target.value = '';
      })
      .catch((err) => {
        setIsImporting(false);
        error(err.message);
        event.target.value = '';
      });
  };

  const toggleDaySelection = (date) => {
    setSelectedDays(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const toggleWeekSelection = (weekKey) => {
    setSelectedWeeks(prev =>
      prev.includes(weekKey)
        ? prev.filter(w => w !== weekKey)
        : [...prev, weekKey]
    );
  };

  const selectAllDays = () => {
    setSelectedDays(availableDays.map(d => d.date));
  };

  const deselectAllDays = () => {
    setSelectedDays([]);
  };

  const selectAllWeeks = () => {
    setSelectedWeeks(availableWeeks.map(w => w.weekKey));
  };

  const deselectAllWeeks = () => {
    setSelectedWeeks([]);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete ALL timesheet data? This action cannot be undone.')) {
      const success = clearAllData();
      if (success) {
        warning('All timesheet data has been cleared');
        setShowRevertOption(false);
        setImportInfo(null);

        // Trigger app refresh
        if (onImportSuccess) {
          onImportSuccess();
        }
      } else {
        error('Failed to clear data');
      }
    }
  };

  const handleRevert = async () => {
    if (window.confirm('Are you sure you want to revert the last import? This will restore all data to its previous state and cannot be undone.')) {
      const reverted = await revertImport();
      if (reverted) {
        success('Data reverted to previous state');
        setShowRevertOption(false);
        setImportInfo(null);

        // Trigger app refresh
        if (onImportSuccess) {
          onImportSuccess();
        }
      } else {
        error('Failed to revert data');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Your data</p>
        <h2 className="mt-1.5 font-display text-lg font-semibold text-gray-900">Data Management</h2>
        <p className="mt-1.5 text-sm text-gray-500">Back up, restore, and manage everything Kronos stores on this device.</p>
      </div>

      <div className="space-y-5">
        {/* Export Section */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Download className="w-[18px] h-[18px]" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 tracking-tight">Export Data</h4>
            </div>
            <button
              onClick={() => setShowAdvancedExport(!showAdvancedExport)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
            >
              {showAdvancedExport ? 'Simple Export' : 'Advanced Export'}
            </button>
          </div>

          {!showAdvancedExport ? (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-gray-500">Download all your timesheet data as a backup file</p>
              <button
                onClick={exportTimesheetData}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 transition-colors duration-150 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Export All</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Export Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="all"
                      checked={exportMode === 'all'}
                      onChange={(e) => setExportMode(e.target.value)}
                      className="accent-blue-600"
                    />
                    <span>All Data</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="days"
                      checked={exportMode === 'days'}
                      onChange={(e) => setExportMode(e.target.value)}
                      className="accent-blue-600"
                    />
                    <span>Specific Days</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="weeks"
                      checked={exportMode === 'weeks'}
                      onChange={(e) => setExportMode(e.target.value)}
                      className="accent-blue-600"
                    />
                    <span>Specific Weeks</span>
                  </label>
                </div>
              </div>

              {/* Day Selection */}
              {exportMode === 'days' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 tabular-nums">
                      Select Days ({selectedDays.length} selected)
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={selectAllDays}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllDays}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 shadow-xs">
                    {availableDays.length === 0 ? (
                      <p className="text-sm text-gray-500">No daily data available</p>
                    ) : (
                      <div className="space-y-1.5">
                        {availableDays.map(day => (
                          <label key={day.date} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedDays.includes(day.date)}
                              onChange={() => toggleDaySelection(day.date)}
                              className="rounded accent-blue-600"
                            />
                            <span className="tabular-nums">{day.formatted} ({day.entries} entries)</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Week Selection */}
              {exportMode === 'weeks' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 tabular-nums">
                      Select Weeks ({selectedWeeks.length} selected)
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={selectAllWeeks}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllWeeks}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 shadow-xs">
                    {availableWeeks.length === 0 ? (
                      <p className="text-sm text-gray-500">No weekly data available</p>
                    ) : (
                      <div className="space-y-1.5">
                        {availableWeeks.map(week => (
                          <label key={week.weekKey} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedWeeks.includes(week.weekKey)}
                              onChange={() => toggleWeekSelection(week.weekKey)}
                              className="rounded accent-blue-600"
                            />
                            <span className="tabular-nums">{week.formatted}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleAdvancedExport}
                  disabled={
                    (exportMode === 'days' && selectedDays.length === 0) ||
                    (exportMode === 'weeks' && selectedWeeks.length === 0)
                  }
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 transition-colors duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Selected</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Import Section */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-600">
                <Upload className="w-[18px] h-[18px]" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 tracking-tight">Import Data</h4>
            </div>
            <button
              onClick={() => setShowAdvancedImport(!showAdvancedImport)}
              className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors duration-150"
            >
              {showAdvancedImport ? 'Simple Import' : 'Advanced Import'}
            </button>
          </div>

          {!showAdvancedImport ? (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-gray-500">Restore all your data from a backup file</p>
              <label className="px-4 py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-green-600/25 transition-colors duration-150 flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : 'Import All'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    setImportMode('all');
                    handleImport(e);
                  }}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Import Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="all"
                      checked={importMode === 'all'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="accent-green-600"
                    />
                    <span>All Data</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="days"
                      checked={importMode === 'days'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="accent-green-600"
                    />
                    <span>Daily Only</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      value="weeks"
                      checked={importMode === 'weeks'}
                      onChange={(e) => setImportMode(e.target.value)}
                      className="accent-green-600"
                    />
                    <span>Weekly Only</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-gray-500">
                    {importMode === 'all' ? 'Restore all data from backup file' :
                     importMode === 'days' ? 'Restore only daily entries from backup file' :
                     'Restore only weekly summaries from backup file'}
                  </p>
                </div>
                <label className="px-4 py-2.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-green-600/25 transition-colors duration-150 flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{isImporting ? 'Importing...' : 'Import'}</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Import Info */}
        {importInfo && (
          <div className="p-5 bg-green-50/80 border border-green-200/80 rounded-2xl">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Import Successful</h4>
                <div className="mt-2 text-sm text-green-800 tabular-nums">
                  <p>Daily entries: {importInfo.dailyEntries}</p>
                  <p>Weekly entries: {importInfo.weeklyEntries}</p>
                  <p>Timezone: {importInfo.timezone}</p>
                  <p>Backup date: {new Date(importInfo.exportDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revert Option */}
        {showRevertOption && (
          <div className="flex items-center justify-between p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100/80 text-amber-600">
                <RotateCcw className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Revert Import</h4>
                <p className="text-[13px] text-gray-500">Restore data to state before last import</p>
              </div>
            </div>
            <button
              onClick={handleRevert}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-amber-600/25 transition-colors duration-150 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Revert</span>
            </button>
          </div>
        )}

        {/* Clear All Data */}
        <div className="flex items-center justify-between p-5 bg-red-50/80 border border-red-200/80 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100/80 text-red-600">
              <AlertTriangle className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Clear All Data</h4>
              <p className="text-[13px] text-gray-500">Permanently delete all timesheet data</p>
            </div>
          </div>
          <button
            onClick={handleClearAll}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-red-600/25 transition-colors duration-150 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">How it works</h4>
          <ul className="text-sm text-gray-600 space-y-2">
            <li><span className="font-medium text-gray-900">Simple Export</span> — downloads all your data at once</li>
            <li><span className="font-medium text-gray-900">Advanced Export</span> — select specific days or weeks to export</li>
            <li><span className="font-medium text-gray-900">Simple Import</span> — restores all your data from a backup file</li>
            <li><span className="font-medium text-gray-900">Advanced Import</span> — restore only daily or only weekly data</li>
            <li><span className="font-medium text-gray-900">Revert</span> — undoes the last import operation</li>
            <li><span className="font-medium text-gray-900">Clear All</span> — permanently deletes all data (cannot be undone)</li>
          </ul>
        </div>
      </div>
    </div>
    </div>
  );
};

export default DataImportExport;
