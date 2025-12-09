import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Menu, X, Globe, Database, Settings } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { loadSidebarState, saveSidebarState } from '../utils/storage';
import TimezoneSelect from './TimezoneSelect';
import DataImportExport from './DataImportExport';

const AppLayout = ({ children, currentView, onViewChange }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => loadSidebarState());
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { clockFormat } = useUserPreferences();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    saveSidebarState(sidebarOpen);
  }, [sidebarOpen]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time in 12-hour AM/PM format with timezone
  const formatTimeInTimezone = (date, timezone, format) => {
    try {
      const formatOptions = {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };

      if (format === '12hour') {
        formatOptions.hour = 'numeric';
        formatOptions.minute = '2-digit';
        formatOptions.hour12 = true;
      } else if (format === '24hour') {
        formatOptions.hour = '2-digit';
        formatOptions.minute = '2-digit';
        formatOptions.hour12 = false;
      }

      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (error) {
      // Fallback to local time if timezone is invalid
      const formatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };

      if (format === '12hour') {
        formatOptions.hour = 'numeric';
        formatOptions.minute = '2-digit';
        formatOptions.hour12 = true;
      } else if (format === '24hour') {
        formatOptions.hour = '2-digit';
        formatOptions.minute = '2-digit';
        formatOptions.hour12 = false;
      }

      return date.toLocaleString('en-US', formatOptions);
    }
  };

  const navigationItems = [
    {
      id: 'tracker',
      label: 'Daily Tracker',
      icon: Clock,
      description: 'Track time in real-time'
    },
    {
      id: 'timesheet',
      label: 'Weekly Timesheet',
      icon: Calendar,
      description: 'View weekly summary'
    },
    {
      id: 'data',
      label: 'Data Management',
      icon: Database,
      description: 'Import/Export data'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'App preferences'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 overflow-hidden`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Kronos</h1>
                <p className="text-xs text-gray-500">Time Tracking</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Globe className="w-4 h-4" />
              <span className="truncate">{selectedTimezone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  {currentView === 'tracker' ? (
                    <Clock className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'timesheet' ? (
                    <Calendar className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'settings' ? (
                    <Settings className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Database className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentView === 'tracker' ? 'Daily Tracker' : 
                     currentView === 'timesheet' ? 'Weekly Timesheet' : 
                     currentView === 'settings' ? 'Settings' :
                     'Data Management'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {currentView === 'tracker' 
                      ? 'Track your time in real-time' 
                      : currentView === 'timesheet'
                      ? 'View your weekly time summary'
                      : currentView === 'settings'
                      ? 'Manage your app preferences'
                      : 'Import and export your data'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Current Time Display */}
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-medium">
                {formatTimeInTimezone(currentTime, selectedTimezone, clockFormat)}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
