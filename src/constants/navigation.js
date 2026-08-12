import { Clock, Timer, Calendar, BarChart3, FileText, Settings } from 'lucide-react';

// The sidebar's navigation entries, in the order a fresh install shows them.
//
// This is the single source of truth: AppLayout renders from it and Settings →
// Sidebar Items reorders/hides it, so both stay in step. An entry missing here
// can't appear in either place.
//
// WHEN YOU ADD A VIEW, add it here and route it in App.jsx. Users who have
// already customized their sidebar keep their order — see reconcileOrder in
// hooks/useSidebarItems.js, which slots newcomers in beside the neighbour they
// ship next to instead of dropping them at the bottom.
export const NAV_ITEMS = [
  {
    id: 'tracker',
    label: 'Tracker',
    icon: Clock,
    description: 'Track time in real-time',
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    icon: Timer,
    description: 'Boost focus with intervals',
  },
  {
    id: 'timesheet',
    label: 'Timesheet',
    icon: Calendar,
    description: 'View weekly summary',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    description: 'Trends, streaks & goals',
  },
  {
    id: 'invoice',
    label: 'Invoice',
    icon: FileText,
    description: 'Generate PDF invoices',
  },
  // No 'data' entry: import/export moved into Settings → Data. A saved layout
  // still listing it is fine — reconcileOrder drops ids this build doesn't ship.
  {
    // Settings can't be hidden: it's the only route back to the control that
    // hides things, so turning it off would strand the user with no way to
    // turn anything back on.
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'App preferences',
    locked: true,
  },
];

export const DEFAULT_NAV_ORDER = NAV_ITEMS.map(item => item.id);

export const NAV_ITEMS_BY_ID = new Map(NAV_ITEMS.map(item => [item.id, item]));

export const isNavItemLocked = (id) => Boolean(NAV_ITEMS_BY_ID.get(id)?.locked);
