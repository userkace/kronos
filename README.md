# Kronos

A modern, intuitive time tracking application built with React and Tailwind CSS. Track your daily tasks, monitor work hours, and manage your productivity with ease.

## Features

- **Time Tracking**: Start, stop, and pause timers for your tasks
- **Daily View**: See all your time entries for any specific day
- **Weekly Timesheets**: Export and manage weekly work summaries
- **Timezone Support**: Works seamlessly across different timezones
- **Data Persistence**: All data saved locally in your browser
- **Manual Entries**: Add or edit time entries manually
- **Task Merging**: Combine duplicate entries with the same description
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Onboarding Flow**: Guided setup for new users
- **Settings Management**: Configure timezone, week start, and clock format
- **Toast Notifications**: User-friendly feedback system
- **Today Page**: Quick overview of current day's activities

## Technologies Used

- **React 19.2.0** - Modern UI framework with latest features
- **Vite 7.2.4** - Fast build tool and development server
- **Tailwind CSS 4.1.17** - Utility-first CSS framework with Vite plugin
- **date-fns 4.1.0** - Date manipulation and formatting
- **date-fns-tz 3.2.0** - Timezone handling
- **Lucide React 0.556.0** - Beautiful icon library
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

### Starting a Timer

1. Enter a task description in the input field
2. Click "Start" or press Enter
3. The timer will begin tracking your time

### Managing Entries

- **Stop Timer**: Click the "Stop" button to end the current timer
- **Manual Entry**: Click "Add Manual Entry" to create time entries manually
- **Edit Entries**: Hover over any entry and click the edit icon
- **Delete Entries**: Use the delete option in the edit modal

### Navigation

- **Previous/Next Day**: Use the arrow buttons to navigate between days
- **Today Button**: Quickly return to the current date
- **Date Selection**: View and manage entries for any specific day
- **View Switching**: Toggle between Daily Tracker, Weekly Timesheet, Settings, and Data Management views

### Settings & Preferences

- **Timezone Configuration**: Set your preferred timezone
- **Week Start Day**: Choose Sunday or Monday as the start of your week
- **Clock Format**: Switch between 12-hour and 24-hour time display
- **Data Management**: Clear all data or reset onboarding

### Data Management

- **Export**: Download your time data as JSON
- **Import**: Upload previously exported time data
- **Weekly Timesheet**: Generate weekly summaries for reporting

## Timezone Support

Kronos automatically detects your timezone and handles all time calculations correctly. You can:
- View times in your local timezone
- Switch between different timezones
- Ensure accurate time tracking across regions

## Data Storage

All your time tracking data is stored locally in your browser using localStorage. This means:
- Your data stays private and on your device
- No internet connection required for basic functionality
- Export your data regularly for backup

## Keyboard Shortcuts

- `Enter`: Start timer with current task description
- `Escape`: Close modals and cancel actions

## Application Structure

Kronos is built with a modular component architecture:

- **App.jsx**: Main application with routing and state management
- **Components**: Reusable UI components for different features
  - `DailyTracker`: Main time tracking interface
  - `TimesheetTable`: Weekly timesheet view
  - `Onboarding`: User setup flow
  - `Settings`: Application preferences
  - `DataImportExport`: Data management utilities
- **Contexts**: React contexts for global state management
  - `TimezoneContext`: Timezone management
  - `UserPreferencesContext`: User settings
  - `ToastContext`: Notification system
- **Utils**: Helper functions for storage and data operations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues or have suggestions for improvements, please open an issue on the GitHub repository.

---

**Kronos** - Making time tracking simple and effective.
