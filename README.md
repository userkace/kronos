# Kronos

A comprehensive time tracking and productivity application built with React and Tailwind CSS. Track your daily tasks, manage work hours, use Pomodoro techniques, generate invoices, and analyze your productivity with powerful data management tools.

## Features

### Core Time Tracking
- **Advanced Timer System**: Start, stop, pause, and resume timers for your tasks
- **Daily View**: Comprehensive view of all time entries for any specific day
- **Weekly Timesheets**: Generate and manage weekly work summaries with automatic calculations
- **Manual Entries**: Add or edit time entries manually with precise time control
- **Task Merging**: Combine duplicate entries with the same description automatically
- **Chronological Sorting**: View entries in chronological or reverse chronological order
- **Break Tracking**: Show/hide break entries for cleaner time analysis

### Pomodoro Timer
- **Work/Break Cycles**: Configurable work sessions, short breaks, and long breaks
- **Customizable Durations**: Set custom durations for work, short break, and long break periods
- **Auto-start Options**: Automatically start breaks and work sessions
- **Task Integration**: Link Pomodoro sessions with time tracking tasks
- **Visual Progress**: Real-time progress indicators and phase tracking
- **Session Management**: Track completed sets and overall productivity

### Invoice Generation
- **PDF Invoice Export**: Generate professional invoices directly from time tracking data
- **Multiple Currencies**: Support for USD, EUR, GBP with customizable rates
- **Client Management**: Set up client information and billing details
- **Automatic Calculations**: Calculate totals, subtotals, and time-based billing
- **Customizable Templates**: Professional invoice layouts with company information
- **Weekly Billing**: Generate invoices based on weekly timesheet data

### Data Management
- **Advanced Export**: Export all data, specific days, or selected weeks as JSON
- **Selective Import**: Import data with options to merge or replace existing data
- **Backup & Restore**: Automatic backup creation before imports with restore capability
- **Data Validation**: Validate imported data for integrity and compatibility
- **Cross-tab Sync**: Real-time synchronization across multiple browser tabs
- **Storage Events**: Automatic updates when data changes in other tabs

### User Experience & Accessibility
- **Motion Preferences**: Customize animations and transitions for reduced motion preferences
- **Responsive Design**: Optimized experience on desktop, tablet, and mobile devices
- **Progress Indicators**: Visual progress bars for active timers and Pomodoro sessions
- **Favicon Notifications**: Browser tab favicon changes to indicate active timer status
- **Keyboard Navigation**: Full keyboard accessibility with comprehensive shortcuts

### Settings & Customization
- **Timezone Support**: Works seamlessly across different timezones with automatic detection
- **Week Configuration**: Choose Sunday or Monday as the start of your week
- **Clock Format**: Switch between 12-hour and 24-hour time display
- **Onboarding Flow**: Guided setup for new users with preference configuration
- **Data Persistence**: All settings and data saved locally in your browser
- **Toast Notifications**: User-friendly feedback system for all actions

### Navigation & Interface
- **Sidebar Navigation**: Collapsible sidebar with quick access to all features
- **Date Picker**: Advanced calendar interface for navigating to any date
- **Today Button**: Quickly return to the current date from any view
- **View Switching**: Seamless switching between Daily Tracker, Pomodoro Timer, Weekly Timesheet, Invoice Generator, Settings, and Data Management
- **Real-time Clock**: Live clock display in selected timezone and format

## Technologies Used

- **React 19.2.0** - Modern UI framework with latest features
- **Vite 7.2.4** - Fast build tool and development server
- **Tailwind CSS 4.1.17** - Utility-first CSS framework with Vite plugin
- **date-fns 4.1.0** - Date manipulation and formatting
- **date-fns-tz 3.2.0** - Timezone handling
- **Framer Motion 12.23.26** - Animation library for smooth transitions
- **Lucide React 0.556.0** - Beautiful icon library
- **@react-pdf/renderer 4.3.2** - PDF generation for invoices
- **ESLint 9.39.1** - Code linting and quality assurance

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kronos
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Linting

```bash
npm run lint
```

Run ESLint to check code quality and style.

### Preview Production Build

```bash
npm run preview
```

Preview the production build locally.

## Usage

### Core Time Tracking

#### Starting a Timer
1. Enter a task description in the input field
2. Click "Start" or press Enter to begin tracking
3. The timer will start and the favicon will change to indicate active tracking
4. Use the pause/resume functionality to take breaks without stopping the timer

#### Managing Time Entries
- **Stop Timer**: Click the "Stop" button to end the current timer and save the entry
- **Manual Entry**: Click "Add Manual Entry" to create time entries with specific start/end times
- **Edit Entries**: Hover over any entry and click the edit icon to modify details
- **Delete Entries**: Use the delete option in the edit modal to remove entries
- **Merge Entries**: Select multiple entries with the same description to merge them
- **Sort Order**: Toggle between chronological and reverse chronological order

#### Date Navigation
- **Previous/Next Day**: Use the arrow buttons to navigate between days
- **Calendar Picker**: Click the date to open an advanced calendar for date selection
- **Today Button**: Quickly return to the current date
- **Date Search**: Jump to any specific date using the calendar interface

### Pomodoro Timer

#### Basic Usage
1. Navigate to the Pomodoro Timer view from the sidebar
2. Set your work duration (default: 25 minutes)
3. Configure short break (default: 5 minutes) and long break (default: 15 minutes) durations
4. Set the number of work sessions per long break
5. Click "Start" to begin your first work session

#### Advanced Features
- **Auto-start**: Enable auto-start for breaks and work sessions to maintain flow
- **Task Integration**: Link Pomodoro sessions to specific tasks for comprehensive tracking
- **Phase Tracking**: Visual indicators show current phase (Work, Short Break, Long Break)
- **Session Counter**: Track completed work sessions and total sets
- **Skip Phase**: Skip current phase if needed (use sparingly for best results)
- **Reset Options**: Reset current session or all sessions as needed

### Invoice Generation

#### Setting Up Invoices
1. Navigate to the Invoice Generator from the sidebar
2. Configure your company information (name, address, contact details)
3. Set up client information for billing
4. Configure hourly rates and currency preferences

#### Generating Invoices
1. Select the week or date range for the invoice
2. Review the time entries that will be included
3. Customize invoice details (invoice number, due date, notes)
4. Click "Generate PDF" to create the invoice
5. Download the professionally formatted PDF for client delivery

#### Invoice Features
- **Multiple Currencies**: Support for USD, EUR, GBP with automatic formatting
- **Time Calculations**: Automatic calculation of hours and totals
- **Professional Layout**: Clean, business-ready invoice design
- **Weekly Summaries**: Generate invoices based on weekly timesheet data
- **Custom Rates**: Set different rates for different clients or projects

### Data Management

#### Exporting Data
1. Navigate to Data Management from the sidebar
2. Choose export mode:
   - **All Data**: Export complete timesheet history
   - **Specific Days**: Select individual days to export
   - **Selected Weeks**: Choose specific weeks for export
3. Click "Export" to download the JSON file
4. Save the export file for backup or migration purposes

#### Importing Data
1. Click "Import Data" in the Data Management section
2. Choose import mode:
   - **Replace All**: Replace existing data with imported data
   - **Merge Data**: Combine imported data with existing entries
   - **Selective Import**: Choose specific days or weeks to import
3. Select your JSON export file
4. Review import summary and confirm
5. Automatic backup is created before import

#### Backup & Restore
- **Automatic Backups**: Backups created automatically before imports
- **Manual Restore**: Revert to previous data state if needed
- **Data Validation**: Imported data is validated for integrity
- **Cross-tab Sync**: Changes automatically sync across all open tabs

### Settings & Customization

#### Basic Settings
- **Timezone**: Select your preferred timezone from the dropdown
- **Week Start**: Choose Sunday or Monday as the start of your week
- **Clock Format**: Switch between 12-hour (AM/PM) and 24-hour display
- **Save Settings**: Click "Save Settings" to apply changes

#### Advanced Preferences
- **Motion Settings**: Reduce or disable animations for better performance
- **Data Management**: Clear all data or reset onboarding flow
- **Sidebar State**: Toggle sidebar collapsed/expanded state
- **Toast Notifications**: Configure notification preferences

#### Onboarding
- **First-time Setup**: Guided flow for new users
- **Preference Configuration**: Set up timezone, week start, and other preferences
- **Tutorial**: Interactive walkthrough of main features
- **Reset Option**: Reset onboarding to show setup screen again

## Keyboard Shortcuts

- `Enter`: Start timer with current task description
- `Escape`: Close modals and cancel actions
- `Tab`: Navigate between interactive elements
- `Space`: Pause/resume active timer when focused
- `Arrow Keys`: Navigate calendar dates and menu items

## Timezone Support

Kronos provides comprehensive timezone support with automatic detection and manual configuration:
- **Automatic Detection**: Detects your system timezone on first launch
- **Manual Selection**: Choose from over 400 timezone options
- **Real-time Conversion**: All time calculations respect selected timezone
- **Cross-region Tracking**: Maintain accurate time tracking when traveling
- **Timezone Preservation**: Exported data maintains timezone information
- **Multiple Display**: View times in different timezones simultaneously

## Data Storage & Synchronization

### Local Storage
All your time tracking data is stored locally in your browser using localStorage:
- **Privacy First**: Your data stays private and on your device
- **Offline Capability**: No internet connection required for basic functionality
- **Instant Access**: Data loads immediately without server delays
- **Export Backup**: Regular export recommended for data safety

### Cross-tab Synchronization
- **Real-time Sync**: Changes automatically sync across all open tabs
- **Storage Events**: Advanced event system for instant updates
- **Conflict Resolution**: Intelligent handling of simultaneous changes
- **State Consistency**: Ensures all tabs show the same data

### Data Integrity
- **Validation**: All data is validated before storage
- **Error Recovery**: Automatic recovery from corrupted data
- **Backup Creation**: Automatic backups before major operations
- **Migration Support**: Seamless data migration between versions

## Accessibility Features

Kronos is built with accessibility in mind:
- **Keyboard Navigation**: Full keyboard accessibility for all features
- **Screen Reader Support**: Compatible with modern screen readers
- **Motion Preferences**: Respect for reduced motion preferences
- **High Contrast**: Supports high contrast mode and system themes
- **Focus Management**: Logical focus flow and visible focus indicators
- **ARIA Labels**: Comprehensive ARIA labeling for screen readers

## Application Structure

Kronos is built with a modular, scalable component architecture:

### Core Application
- **App.jsx**: Main application with routing, providers, and state management
- **AppLayout.jsx**: Layout component with sidebar navigation and responsive design

### Feature Components
- **DailyTracker**: Main time tracking interface with advanced timer controls
- **PomodoroTimer**: Full-featured Pomodoro technique implementation
- **TimesheetTable**: Weekly timesheet view with calculations and summaries
- **InvoicePage**: PDF invoice generation with client management
- **DataImportExport**: Advanced data management with selective operations
- **Settings**: Comprehensive settings and preference management
- **Onboarding**: Guided setup flow for new users
- **TimeEntryModal**: Modal for adding and editing time entries

### UI Components
- **DatePicker**: Advanced calendar component with timezone support
- **TimezoneSelect**: Dropdown for timezone selection
- **PomodoroProgressBar**: Visual progress indicator for Pomodoro sessions
- **DailyTrackerProgressBar**: Progress indicator for daily time tracking

### Context Providers
- **TimezoneContext**: Global timezone management and conversion
- **UserPreferencesContext**: User settings and preferences state
- **ToastContext**: Notification system for user feedback
- **PomodoroContext**: Pomodoro timer state and configuration

### Utilities & Hooks
- **storage.js**: LocalStorage management with validation and error handling
- **dataImportExport.js**: Advanced data import/export with backup/restore
- **entryUtils.js**: Time entry manipulation and sorting utilities
- **faviconManager.js**: Dynamic favicon management for timer status
- **storageEvents.js**: Cross-tab synchronization system
- **timezoneUtils.js**: Advanced timezone calculation utilities
- **useMotionPreferences.js**: Hook for managing animation preferences
- **useUnifiedDisplay.js**: Hook for consistent time display formatting

## Performance Optimizations

- **Memoization**: Strategic use of React.memo and useMemo for performance
- **Lazy Loading**: Components loaded on-demand to reduce initial bundle size
- **Efficient Updates**: Optimized re-renders with proper dependency management
- **Storage Optimization**: Efficient localStorage usage with data compression
- **Animation Performance**: Hardware-accelerated animations with Framer Motion
- **Bundle Optimization**: Tree-shaking and code splitting for faster load times

## Troubleshooting

### Common Issues

**Timer Not Starting**
- Ensure you've entered a task description
- Check that your browser supports localStorage
- Try refreshing the page and restarting the timer

**Data Not Saving**
- Check browser localStorage permissions
- Clear browser cache and try again
- Export data regularly as backup

**Timezone Issues**
- Verify your system timezone is correct
- Manually select your timezone in Settings
- Restart the application after timezone changes

**Cross-tab Sync Problems**
- Ensure both tabs are on the same domain
- Check that localStorage is enabled
- Refresh both tabs to re-establish sync

**Invoice Generation Issues**
- Verify you have time entries for the selected period
- Check that client information is properly configured
- Ensure your browser supports PDF downloads

**Performance Issues**
- Enable reduced motion in Settings
- Close unused browser tabs
- Export and clear old data if storage is full

### Browser Compatibility

Kronos works best with modern browsers:
- **Chrome 90+**: Full feature support
- **Firefox 88+**: Full feature support
- **Safari 14+**: Full feature support
- **Edge 90+**: Full feature support

### Data Recovery

If you experience data loss:
1. Check for automatic backups in Data Management
2. Import your most recent export file
3. Contact support with browser console errors

## Contributing

We welcome contributions to make Kronos even better!

### Development Setup
1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Create a feature branch for your changes

### Contribution Guidelines
- Follow the existing code style and patterns
- Add tests for new features
- Update documentation for any UI changes
- Ensure all accessibility features are maintained
- Test across different browsers and devices

### Submitting Changes
1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature')`
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request with detailed description

## Support

### Getting Help
- **Documentation**: Check this README and inline tooltips
- **Issues**: Report bugs and request features on GitHub
- **Community**: Join discussions in GitHub Issues
- **Email**: Contact support for enterprise inquiries

### Feature Requests
We love hearing your ideas! When requesting features:
- Describe the use case and problem you're solving
- Provide examples of how you'd like it to work
- Consider how it benefits other users

### Bug Reports
Help us fix issues quickly by providing:
- Browser version and operating system
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages from browser console

---

**Kronos** - Comprehensive time tracking, Pomodoro productivity, invoice generation, and data management - all in one powerful application.

*Track your time, boost your productivity, manage your billing, and take control of your work day with Kronos.*
