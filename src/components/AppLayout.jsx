import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Menu, X, Globe, Database, Settings, Timer, FileText, Bell, BarChart3 } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { loadSidebarState, saveSidebarState } from '../utils/storage';
import TimezoneSelect from './TimezoneSelect';
import DataImportExport from './DataImportExport';
import PomodoroProgressBar from './atoms/PomodoroProgressBar';
import DailyTrackerProgressBar from './atoms/DailyTrackerProgressBar';

const formatTimezoneDisplay = (tz) => {
  const city = tz.split('/').pop().replace(/_/g, ' ');
  try {
    const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? '';
    return { city, offset };
  } catch {
    return { city, offset: '' };
  }
};

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
      description: 'Boost focus with intervals'
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

  const activeNavItem = navigationItems.find((item) => item.id === currentView);

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-50 ${
        sidebarOpen
          ? 'translate-x-0 w-64'
          : '-translate-x-full lg:translate-x-0 w-0'
      } transition-all duration-300 ease-in-out h-full bg-white border-r border-gray-200/80 flex-col lg:flex overflow-hidden`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="px-5 pt-6 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <img
                src="/kronos-192.png"
                alt="Kronos"
                className="w-9 h-9 rounded-xl shrink-0 shadow-xs"
              />
              <div className="flex flex-col justify-center">
                <h1 className="font-display text-sm font-semibold text-gray-900 leading-5 lowercase tracking-wide">kronos</h1>
                <p className="text-xs text-gray-400 leading-tight">Own your time.</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <div className="space-y-1">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="text-left">
                      <div className="text-sm font-medium leading-5">{item.label}</div>
                      <div className={`text-xs leading-4 ${isActive ? 'text-blue-600/70' : 'text-gray-400'}`}>{item.description}</div>
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
          <div className="px-5 py-4 border-t border-gray-100">
            {/* Timezone Display */}
            <div className="flex items-center gap-2 text-[13px] text-gray-500">
              <Globe className="w-4 h-4 shrink-0 text-gray-400" />
              {(() => { const { city, offset } = formatTimezoneDisplay(selectedTimezone); return (
                <span className="truncate">{city}{offset ? ` · ${offset}` : ''}</span>
              ); })()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — intentionally minimal: the page title only shows when the
            sidebar is hidden, so it never duplicates the active nav item. */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-150"
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className={`flex items-center min-w-0 ${sidebarOpen ? 'lg:hidden' : ''}`}>
              <div className="h-5 w-px bg-gray-200 mx-3" aria-hidden="true" />
              <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight truncate">
                {activeNavItem?.label ?? 'Kronos'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onShowChangelog && (
              <button
                type="button"
                onClick={onShowChangelog}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-150"
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
            <div className="flex items-center gap-2 text-[13px] text-gray-600 bg-gray-50 border border-gray-200/70 px-3.5 py-2 rounded-full">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="font-medium tabular-nums">
                {formatNavDateTime(currentTime, selectedTimezone, clockFormat, dateFormat)}
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
