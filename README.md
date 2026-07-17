<div align="center">

# ⏱️ Kronos

**Time tracking, Pomodoro productivity, and invoicing — all in one place.**

Track your daily tasks, manage work hours, stay focused with the Pomodoro technique, generate professional invoices, and keep full control of your data. Everything runs locally in your browser.

**[🌐 kronos.kace.dev](https://kronos.kace.dev/)** · [mirror: kronos-eta.pages.dev](https://kronos-eta.pages.dev/)

<br>

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)

</div>

---

## Table of Contents

- [Highlights](#highlights)
- [Features](#features)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Your Data & Privacy](#your-data--privacy)
- [Accessibility](#accessibility)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)

---

## Highlights

| | |
|---|---|
| ⏱️ **Time Tracking** | Start/stop/pause timers, manual entries, daily & weekly views |
| 🍅 **Pomodoro Timer** | Configurable work/break cycles with task integration |
| 🧾 **Invoicing** | Generate professional PDF invoices from your tracked time |
| 💾 **Data Management** | Export, import, backup, and restore — you own your data |
| 🔒 **Privacy First** | Everything is stored locally in your browser, no server required |
| ♿ **Accessible** | Full keyboard navigation, screen reader support, reduced-motion |

---

## Features

### Core Time Tracking
- **Advanced timer** — start, stop, pause, and resume timers for any task
- **Daily view** — see every time entry for a given day at a glance
- **Weekly timesheets** — automatic weekly summaries and calculations
- **Manual entries** — add or edit entries with precise start/end times
- **Task merging** — combine duplicate entries with the same description
- **Flexible sorting** — chronological or reverse order, with break entries shown or hidden

### Pomodoro Timer
- **Work/break cycles** — customizable work, short break, and long break durations
- **Auto-start** — chain sessions automatically to stay in flow
- **Task integration** — link Pomodoro sessions to tracked tasks
- **Visual progress** — real-time phase indicators and completed-set tracking

### Invoice Generation
- **PDF export** — professional, business-ready invoices from your time data
- **Multiple currencies** — USD, EUR, and GBP with automatic formatting
- **Client & company details** — configurable billing information
- **Automatic calculations** — hours, subtotals, and totals from weekly timesheets

### Data Management
- **Flexible export** — all data, specific days, or selected weeks as JSON
- **Selective import** — merge with or replace existing data
- **Backup & restore** — automatic backups created before every import
- **Validation** — imported data is checked for integrity and compatibility

### Settings & Experience
- **Timezone support** — automatic detection plus 400+ manual options
- **Week configuration** — start your week on Sunday or Monday
- **Clock format** — 12-hour or 24-hour display
- **Guided onboarding** — quick setup for new users
- **Responsive design** — optimized for desktop, tablet, and mobile
- **Cross-tab sync** — changes update instantly across all open tabs
- **Favicon notifications** — the browser tab shows active-timer status

---

## Getting Started

### Use It Online

No installation needed — Kronos runs entirely in your browser:

- **[kronos.kace.dev](https://kronos.kace.dev/)** (primary)
- [kronos-eta.pages.dev](https://kronos-eta.pages.dev/) (alternative)

### Prerequisites
- **Node.js** 18 or higher
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd kronos

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production (output in `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint to check code quality |

---

## Usage Guide

### Tracking Time
1. Enter a task description and click **Start** (or press <kbd>Enter</kbd>).
2. The favicon updates to show a timer is running.
3. **Pause/resume** to take breaks without ending the session.
4. Click **Stop** to save the entry.

Use **Add Manual Entry** for past work, hover an entry to **edit** or **delete** it, and select entries with matching descriptions to **merge** them. Navigate days with the arrow buttons, the calendar picker, or the **Today** button.

### Using the Pomodoro Timer
1. Open the **Pomodoro Timer** view from the sidebar.
2. Set your work duration (default **25 min**), short break (**5 min**), and long break (**15 min**).
3. Choose how many work sessions precede a long break.
4. Click **Start** — enable auto-start to chain phases automatically, and link sessions to tasks for unified tracking.

### Generating an Invoice
1. Open the **Invoice Generator** and fill in your company and client details.
2. Set your hourly rate and currency.
3. Select the week or date range and review the included entries.
4. Add invoice number, due date, and notes, then click **Generate PDF** to download.

### Managing Your Data
- **Export** — choose all data, specific days, or selected weeks, then download the JSON file.
- **Import** — pick **Replace**, **Merge**, or **Selective** mode; a backup is created automatically first.
- **Restore** — roll back to a previous state if needed.

### Adjusting Settings
Configure your **timezone**, **week start**, and **clock format**, tune **motion preferences** for performance or accessibility, and re-run **onboarding** any time from the Settings view.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| <kbd>Enter</kbd> | Start timer with the current task |
| <kbd>Space</kbd> | Pause / resume the active timer (when focused) |
| <kbd>Escape</kbd> | Close modals and cancel actions |
| <kbd>Tab</kbd> | Move between interactive elements |
| <kbd>Arrow Keys</kbd> | Navigate calendar dates and menus |

---

## Your Data & Privacy

Kronos stores everything **locally in your browser** using `localStorage` — no accounts, no servers, no tracking.

- **Private by default** — your data never leaves your device
- **Works offline** — no connection needed for core features
- **Instant** — data loads immediately, no server round-trips
- **Cross-tab sync** — changes propagate across open tabs in real time
- **Resilient** — data is validated on load, with automatic backups before major operations

> 💡 **Tip:** Export your data regularly. Since everything lives in your browser, clearing site data will remove it — keep a backup.

---

## Accessibility

Kronos is built to be usable by everyone:

- **Full keyboard navigation** for every feature
- **Screen reader support** with comprehensive ARIA labeling
- **Reduced-motion** preference support
- **High-contrast** and system-theme compatibility
- **Logical focus flow** with visible focus indicators

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| **React** | 19.2.0 | UI framework |
| **Vite** | 7.2.4 | Build tool & dev server |
| **Tailwind CSS** | 4.1.17 | Utility-first styling |
| **date-fns** | 4.1.0 | Date manipulation |
| **date-fns-tz** | 3.2.0 | Timezone handling |
| **Framer Motion** | 12.23.26 | Animations |
| **Lucide React** | 0.556.0 | Icons |
| **@react-pdf/renderer** | 4.3.2 | Invoice PDF generation |
| **ESLint** | 9.39.1 | Linting |

---

## Project Structure

Kronos uses a modular, scalable component architecture.

```
src/
├── App.jsx                 # Routing, providers, and top-level state
├── AppLayout.jsx           # Sidebar navigation & responsive layout
├── components/
│   ├── DailyTracker        # Main time-tracking interface
│   ├── PomodoroTimer       # Pomodoro technique implementation
│   ├── TimesheetTable      # Weekly timesheet with calculations
│   ├── InvoicePage         # PDF invoice generation
│   ├── DataImportExport    # Data management operations
│   ├── Settings            # Preferences & configuration
│   ├── Onboarding          # Guided setup for new users
│   └── ...                 # DatePicker, modals, progress bars, etc.
├── context/
│   ├── TimezoneContext     # Global timezone management
│   ├── UserPreferencesContext
│   ├── ToastContext        # Notification system
│   └── PomodoroContext     # Pomodoro state & config
└── utils/
    ├── storage.js          # localStorage with validation
    ├── dataImportExport.js # Import/export with backup/restore
    ├── entryUtils.js       # Entry manipulation & sorting
    ├── faviconManager.js   # Dynamic favicon status
    ├── storageEvents.js    # Cross-tab synchronization
    └── timezoneUtils.js    # Timezone calculations
```

---

## Troubleshooting

<details>
<summary><strong>Timer won't start</strong></summary>

- Make sure you've entered a task description.
- Confirm your browser allows `localStorage`.
- Refresh the page and try again.
</details>

<details>
<summary><strong>Data isn't saving</strong></summary>

- Check your browser's `localStorage` permissions.
- Clear the cache and reload.
- Export your data regularly as a backup.
</details>

<details>
<summary><strong>Timezone looks wrong</strong></summary>

- Verify your system timezone.
- Manually select your timezone in Settings.
- Reload the app after changing it.
</details>

<details>
<summary><strong>Cross-tab sync isn't working</strong></summary>

- Ensure both tabs are on the same domain.
- Confirm `localStorage` is enabled.
- Refresh both tabs to re-establish sync.
</details>

<details>
<summary><strong>Invoice won't generate</strong></summary>

- Confirm there are time entries in the selected period.
- Check that client information is filled in.
- Make sure your browser allows PDF downloads.
</details>

**Supported browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.

---

## Contributing

Contributions are welcome!

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes, following the existing code style and keeping accessibility intact.
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request with a clear description.

Please test across different browsers and devices, and update documentation for any UI changes.

---

## Support

- **Docs** — this README and in-app tooltips
- **Issues** — report bugs and request features on [GitHub Issues](https://github.com/userkace/kronos/issues)
- **Community** — join the discussion in [GitHub Issues](https://github.com/userkace/kronos/issues)

When reporting a bug, include your browser and OS, steps to reproduce, expected vs. actual behavior, and any console errors. For feature requests, describe the problem you're solving and how you'd like it to work.

---

**Kronos** - Comprehensive time tracking, Pomodoro productivity, invoice generation, and data management - all in one powerful application.

*Track your time, boost your productivity, manage your billing, and take control of your work day with Kronos.*

Built by [@userkace](https://github.com/userkace) · [userkace/kronos](https://github.com/userkace/kronos)
