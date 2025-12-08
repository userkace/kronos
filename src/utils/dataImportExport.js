// Export/Import utilities for timesheet data

export const exportTimesheetData = () => {
  try {
    // Get all data from localStorage using correct keys
    const dailyData = localStorage.getItem('kronos_timesheet_data');
    const weeklyData = localStorage.getItem('kronos_weekly_timesheet');
    const timezone = localStorage.getItem('kronos_selected_timezone');
    
    const exportData = {
      dailyData: dailyData ? JSON.parse(dailyData) : {},
      weeklyData: weeklyData ? JSON.parse(weeklyData) : {},
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
    
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate data structure
        if (!importData.version || !importData.dailyData || !importData.weeklyData) {
          throw new Error('Invalid backup file format');
        }
        
        // Backup current data before import
        const currentBackup = {
          dailyData: localStorage.getItem('kronos_timesheet_data'),
          weeklyData: localStorage.getItem('kronos_weekly_timesheet'),
          timezone: localStorage.getItem('kronos_selected_timezone'),
          backupDate: new Date().toISOString()
        };
        
        // Store backup in case user wants to revert
        localStorage.setItem('timesheetImportBackup', JSON.stringify(currentBackup));
        
        // Import based on mode
        if (importMode === 'all') {
          localStorage.setItem('kronos_timesheet_data', JSON.stringify(importData.dailyData));
          localStorage.setItem('kronos_weekly_timesheet', JSON.stringify(importData.weeklyData));
          if (importData.timezone) {
            localStorage.setItem('kronos_selected_timezone', importData.timezone);
          }
        } else if (importMode === 'days') {
          localStorage.setItem('kronos_timesheet_data', JSON.stringify(importData.dailyData));
          // Don't import weekly data
        } else if (importMode === 'weeks') {
          localStorage.setItem('kronos_weekly_timesheet', JSON.stringify(importData.weeklyData));
          // Don't import daily data
        }
        
        resolve({
          success: true,
          message: 'Data imported successfully',
          imported: {
            dailyEntries: Object.keys(importData.dailyData).length,
            weeklyEntries: Object.keys(importData.weeklyData).length,
            timezone: importData.timezone,
            exportDate: importData.exportDate,
            importMode
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
    
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate data structure
        if (!importData.version || !importData.dailyData || !importData.weeklyData) {
          throw new Error('Invalid backup file format');
        }
        
        // Backup current data before import
        const currentBackup = {
          dailyData: localStorage.getItem('kronos_timesheet_data'),
          weeklyData: localStorage.getItem('kronos_weekly_timesheet'),
          timezone: localStorage.getItem('kronos_selected_timezone'),
          backupDate: new Date().toISOString()
        };
        
        // Store backup in case user wants to revert
        localStorage.setItem('timesheetImportBackup', JSON.stringify(currentBackup));
        
        // Import new data
        localStorage.setItem('kronos_timesheet_data', JSON.stringify(importData.dailyData));
        localStorage.setItem('kronos_weekly_timesheet', JSON.stringify(importData.weeklyData));
        if (importData.timezone) {
          localStorage.setItem('kronos_selected_timezone', importData.timezone);
        }
        
        resolve({
          success: true,
          message: 'Data imported successfully',
          imported: {
            dailyEntries: Object.keys(importData.dailyData).length,
            weeklyEntries: Object.keys(importData.weeklyData).length,
            timezone: importData.timezone,
            exportDate: importData.exportDate
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

export const revertImport = () => {
  try {
    const backup = localStorage.getItem('timesheetImportBackup');
    if (!backup) {
      throw new Error('No backup found to revert');
    }
    
    const backupData = JSON.parse(backup);
    
    // Restore previous data
    if (backupData.dailyData) {
      localStorage.setItem('kronos_timesheet_data', backupData.dailyData);
    }
    if (backupData.weeklyData) {
      localStorage.setItem('kronos_weekly_timesheet', backupData.weeklyData);
    }
    if (backupData.timezone) {
      localStorage.setItem('kronos_selected_timezone', backupData.timezone);
    }
    
    // Remove backup after successful revert
    localStorage.removeItem('timesheetImportBackup');
    
    return true;
  } catch (error) {
    console.error('Revert failed:', error);
    return false;
  }
};

export const hasImportBackup = () => {
  return localStorage.getItem('timesheetImportBackup') !== null;
};

export const clearAllData = () => {
  try {
    // Clear all timesheet-related data
    localStorage.removeItem('kronos_timesheet_data');
    localStorage.removeItem('kronos_weekly_timesheet');
    localStorage.removeItem('timesheetImportBackup');
    
    return true;
  } catch (error) {
    console.error('Clear data failed:', error);
    return false;
  }
};
