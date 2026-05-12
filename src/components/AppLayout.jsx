import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Menu, X, Globe, Database, Settings, Timer, FileText, Bell, BarChart3 } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { loadSidebarState, saveSidebarState } from '../utils/storage';
import TimezoneSelect from './TimezoneSelect';
import DataImportExport from './DataImportExport';
import PomodoroProgressBar from './atoms/PomodoroProgressBar';
import DailyTrackerProgressBar from './atoms/DailyTrackerProgressBar';

const AppLayout = ({ children, currentView, onViewChange, onShowChangelog, hasUnseenChangelog }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => loadSidebarState());
  const { selectedTimezone, changeTimezone } = useTimezone();
  const { clockFormat, dateFormat } = useUserPreferences();
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

  const formatNavDateTime = (date, timezone, clockFmt, dateFmt) => {
    const dateOptions = {
      short:         { month: 'short', day: 'numeric', year: 'numeric' },
      long:          { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
      numeric:       { month: 'numeric', day: 'numeric', year: 'numeric' },
      dmy:           { day: 'numeric', month: 'numeric', year: 'numeric' },
      weekday:       { weekday: 'short', month: 'short', day: 'numeric' },
      'weekday-year':{ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
      'short-no-year': { month: 'short', day: 'numeric' },
      iso:           null, // handled manually below
      none:          null,
    };

    const timeOpts = clockFmt === '24hour'
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: 'numeric', minute: '2-digit', hour12: true };

    const tz = { timeZone: timezone };

    const formatDatePart = (d, fmt, tzOpt) => {
      if (fmt === 'none') return null;
      if (fmt === 'iso') {
        // YYYY-MM-DD in the user's timezone
        const parts = new Intl.DateTimeFormat('en-CA', { ...tzOpt, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        return parts; // en-CA gives YYYY-MM-DD natively
      }
      if (fmt === 'dmy') {
        // DD/MM/YYYY
        const p = new Intl.DateTimeFormat('en-GB', { ...tzOpt, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
        return p; // en-GB gives DD/MM/YYYY natively
      }
      const opts = dateOptions[fmt];
      if (!opts) return null;
      return new Intl.DateTimeFormat('en-US', { ...tzOpt, ...opts }).format(d);
    };

    try {
      const time = new Intl.DateTimeFormat('en-US', { ...tz, ...timeOpts }).format(date);
      const datePart = formatDatePart(date, dateFmt, tz);
      return datePart ? `${datePart}, ${time}` : time;
    } catch {
      const time = date.toLocaleString('en-US', timeOpts);
      if (dateFmt === 'none' || dateFmt === 'iso') return time;
      const opts = dateOptions[dateFmt];
      if (!opts) return time;
      const datePart = date.toLocaleString('en-US', opts);
      return `${datePart}, ${time}`;
    }
  };

  const navigationItems = [
    {
      id: 'tracker',
      label: 'Tracker',
      icon: Clock,
      description: 'Track time in real-time'
    },
    {
      id: 'pomodoro',
      label: 'Pomodoro',
      icon: Timer,
      description: 'Focus with time management'
    },
    {
      id: 'timesheet',
      label: 'Timesheet',
      icon: Calendar,
      description: 'View weekly summary'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      description: 'Trends, streaks & goals'
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: FileText,
      description: 'Generate PDF invoices'
    },
    {
      id: 'data',
      label: 'Data',
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
    <div className="flex h-screen bg-gray-50 relative">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[1px] bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-50 ${
        sidebarOpen
          ? 'translate-x-0 w-64'
          : '-translate-x-full lg:translate-x-0 w-0'
      } transition-all duration-300 ease-in-out h-full bg-white border-r border-gray-200 flex-col lg:flex overflow-hidden`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img
                src="/kronos-192.png"
                alt="Kronos"
                className="w-8 h-8 rounded-lg shrink-0"
              />
              <div className="flex flex-col justify-center">
                <h1 className="text-lg font-semibold text-gray-900 leading-4">Kronos</h1>
                <p className="text-xs text-gray-500 leading-tight">Own your time.</p>
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
                    onClick={() => {
                      onViewChange(item.id);
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
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

          {/* Show DailyTracker progress bar only when not on tracker view */}
          {currentView !== 'tracker' && <DailyTrackerProgressBar onViewChange={onViewChange} className="mx-4" timezone={selectedTimezone} />}

          {/* Show Pomodoro progress bar only when not on Pomodoro view */}
          {currentView !== 'pomodoro' && <PomodoroProgressBar onViewChange={onViewChange} className="mx-4" />}

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            {/* Timezone Display */}
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
                  ) : currentView === 'pomodoro' ? (
                    <Timer className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'timesheet' ? (
                    <Calendar className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'reports' ? (
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'invoice' ? (
                    <FileText className="w-5 h-5 text-blue-600" />
                  ) : currentView === 'settings' ? (
                    <Settings className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Database className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentView === 'tracker' ? 'Tracker' :
                     currentView === 'pomodoro' ? 'Pomodoro' :
                     currentView === 'timesheet' ? 'Timesheet' :
                     currentView === 'reports' ? 'Reports' :
                     currentView === 'invoice' ? 'Invoice' :
                     currentView === 'settings' ? 'Settings' :
                     'Data'}
                  </h2>
                  <p className="text-sm text-gray-500 hidden sm:block">
                    {currentView === 'tracker'
                      ? 'Track your time in real-time'
                      : currentView === 'pomodoro'
                      ? 'Stay focused with time management'
                      : currentView === 'timesheet'
                      ? 'View your weekly time summary'
                      : currentView === 'reports'
                      ? 'Trends, streaks, and daily goals'
                      : currentView === 'invoice'
                      ? 'Generate professional PDF invoices'
                      : currentView === 'settings'
                      ? 'Manage your app preferences'
                      : 'Import and export your data'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {onShowChangelog && (
                <button
                  type="button"
                  onClick={onShowChangelog}
                  className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={hasUnseenChangelog ? "What's new (unread updates)" : "What's new"}
                  title="What's new"
                >
                  <Bell className="w-5 h-5" />
                  {hasUnseenChangelog && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"
                    />
                  )}
                </button>
              )}

              {/* Current Time Display */}
              <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {formatNavDateTime(currentTime, selectedTimezone, clockFormat, dateFormat)}
                </span>
              </div>
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
