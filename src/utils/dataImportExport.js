// Export/Import utilities for timesheet data
import {
  loadTimesheetData,
  saveTimesheetData,
  loadWeeklyTimesheet,
  saveWeeklyTimesheet,
} from './storage';
import { idbGet, idbSet, idbDelete } from './timesheetDB';

const BACKUP_KEY = 'timesheetImportBackup';

// Validation helpers — applied before any import write so a malformed backup
// can't seed the app with data that crashes downstream parseISO calls (which
// would have appeared as silent zeros in totals rather than visible errors).

const isYyyyMmDd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const isParseableISOInstant = (s) => {
  if (typeof s !== 'string' || s.length === 0) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
};

const validateDailyData = (dailyData) => {
  if (!dailyData || typeof dailyData !== 'object' || Array.isArray(dailyData)) {
    return 'dailyData is missing or not a plain object';
  }
  for (const [dateKey, entries] of Object.entries(dailyData)) {
    if (!isYyyyMmDd(dateKey)) {
      return `Bad date key in dailyData: "${dateKey}" (expected yyyy-MM-dd)`;
    }
    if (!Array.isArray(entries)) {
      return `dailyData["${dateKey}"] is not an array`;
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || typeof entry !== 'object') {
        return `dailyData["${dateKey}"][${i}] is not an object`;
      }
      if (entry.id == null) {
        return `dailyData["${dateKey}"][${i}] is missing id`;
      }
      if (!isParseableISOInstant(entry.startTime)) {
        return `dailyData["${dateKey}"][${i}].startTime is not a valid ISO string`;
      }
      // endTime is optional only for active timer entries.
      if (!entry.isActive && !isParseableISOInstant(entry.endTime)) {
        return `dailyData["${dateKey}"][${i}].endTime is not a valid ISO string`;
      }
    }
  }
  return null;
};

const validateWeeklyData = (weeklyData) => {
  if (!weeklyData || typeof weeklyData !== 'object' || Array.isArray(weeklyData)) {
    return 'weeklyData is missing or not a plain object';
  }
  for (const [dateKey, dayData] of Object.entries(weeklyData)) {
    if (!isYyyyMmDd(dateKey)) {
      return `Bad date key in weeklyData: "${dateKey}" (expected yyyy-MM-dd)`;
    }
    if (!dayData || typeof dayData !== 'object' || Array.isArray(dayData)) {
      return `weeklyData["${dateKey}"] is not a plain object`;
    }
  }
  return null;
};

const validateImportShape = (importData) => {
  if (!importData || typeof importData !== 'object') {
    return 'Backup is not an object';
  }
  if (!importData.version) {
    return 'Backup is missing the version field';
  }
  // Treat absent fields as empty — older exports may omit one or both
  const dailyError = validateDailyData(importData.dailyData ?? {});
  if (dailyError) return dailyError;
  const weeklyError = validateWeeklyData(importData.weeklyData ?? {});
  if (weeklyError) return weeklyError;
  return null;
};

export const exportTimesheetData = () => {
  try {
    const timezone = localStorage.getItem('kronos_selected_timezone');
    const exportData = {
      dailyData: loadTimesheetData(),
      weeklyData: loadWeeklyTimesheet(),
      timezone: timezone || 'UTC',
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
};

export const importTimesheetDataSelective = (file, importMode) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // Deep-validate the backup shape so malformed entries can't slip
        // through and produce silent zeros via Invalid Date downstream.
        const shapeError = validateImportShape(importData);
        if (shapeError) {
          throw new Error('Invalid backup: ' + shapeError);
        }

        // Backup current data to IDB before import
        await idbSet(BACKUP_KEY, {
          dailyData: loadTimesheetData(),
          weeklyData: loadWeeklyTimesheet(),
          timezone: localStorage.getItem('kronos_selected_timezone'),
          backupDate: new Date().toISOString(),
        });

        // Import based on mode
        if (importMode === 'all') {
          saveTimesheetData(importData.dailyData ?? {});
          saveWeeklyTimesheet(importData.weeklyData ?? {});
          if (importData.timezone) {
            localStorage.setItem('kronos_selected_timezone', importData.timezone);
          }
        } else if (importMode === 'days') {
          saveTimesheetData(importData.dailyData ?? {});
        } else if (importMode === 'weeks') {
          saveWeeklyTimesheet(importData.weeklyData ?? {});
        }

        resolve({
          success: true,
          message: 'Data imported successfully',
          imported: {
            dailyEntries: Object.keys(importData.dailyData ?? {}).length,
            weeklyEntries: Object.keys(importData.weeklyData ?? {}).length,
            timezone: importData.timezone,
            exportDate: importData.exportDate,
            importMode,
          }
        });
      } catch (error) {
        reject(new Error('Failed to parse backup file: ' + error.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const importTimesheetData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        // Deep-validate the backup shape so malformed entries can't slip
        // through and produce silent zeros via Invalid Date downstream.
        const shapeError = validateImportShape(importData);
        if (shapeError) {
          throw new Error('Invalid backup: ' + shapeError);
        }
        
        // Backup current data to IDB before import
        await idbSet(BACKUP_KEY, {
          dailyData: loadTimesheetData(),
          weeklyData: loadWeeklyTimesheet(),
          timezone: localStorage.getItem('kronos_selected_timezone'),
          backupDate: new Date().toISOString(),
        });

        // Import new data
        saveTimesheetData(importData.dailyData ?? {});
        saveWeeklyTimesheet(importData.weeklyData ?? {});
        if (importData.timezone) {
          localStorage.setItem('kronos_selected_timezone', importData.timezone);
        }

        resolve({
          success: true,
          message: 'Data imported successfully',
          imported: {
            dailyEntries: Object.keys(importData.dailyData ?? {}).length,
            weeklyEntries: Object.keys(importData.weeklyData ?? {}).length,
            timezone: importData.timezone,
            exportDate: importData.exportDate,
          }
        });
      } catch (error) {
        reject(new Error('Failed to parse backup file: ' + error.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const revertImport = async () => {
  try {
    const backupData = await idbGet(BACKUP_KEY);
    if (!backupData) {
      throw new Error('No backup found to revert');
    }

    if (backupData.dailyData) saveTimesheetData(backupData.dailyData);
    if (backupData.weeklyData) saveWeeklyTimesheet(backupData.weeklyData);
    if (backupData.timezone) {
      localStorage.setItem('kronos_selected_timezone', backupData.timezone);
    }

    await idbDelete(BACKUP_KEY);
    return true;
  } catch (error) {
    console.error('Revert failed:', error);
    return false;
  }
};

export const hasImportBackup = async () => {
  const backup = await idbGet(BACKUP_KEY);
  return backup != null;
};

export const clearAllData = () => {
  try {
    idbDelete(BACKUP_KEY).catch(err =>
      console.error('IDB delete failed for import backup:', err)
    );
    saveTimesheetData({});
    saveWeeklyTimesheet({});
    return true;
  } catch (error) {
    console.error('Clear data failed:', error);
    return false;
  }
};
