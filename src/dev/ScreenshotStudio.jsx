// Screenshot Studio — Settings → Developer.
//
// One screen for photographing the app in states that are otherwise a chore to
// reach: a timer mid-run, a quarter of history, a sync conflict, an empty
// first day. Every scenario mounts the real components (see scenarios.jsx)
// against a sandboxed copy of storage (see sandbox.js), so what you capture is
// what ships, and nothing you do in here touches your own data.
//
// Two ways around: a gallery of cards, and a rail beside the stage for
// stepping through them. J/K or the arrow keys move between scenarios, so you
// can shoot a whole set without reaching for the mouse.

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  X, Search, LayoutGrid, Monitor, Laptop, Tablet, Smartphone, Sun, Moon,
  PanelsTopLeft, Maximize2, Keyboard, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';

import { ToastProvider } from '../contexts/ToastContext';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { TimezoneProvider, useTimezone } from '../contexts/TimezoneContext';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { PomodoroProvider } from '../contexts/PomodoroContext';
import { useTheme } from '../contexts/ThemeContext';
import AppLayout from '../components/AppLayout';
import { loadTimesheetData, loadWeeklyTimesheet } from '../utils/storage';
import faviconManager from '../utils/faviconManager';

import { enterSandbox, exitSandbox, resetSandbox } from './sandbox';
import { SCENARIOS, SCENARIO_GROUPS, findScenario, seedBaseline } from './scenarios';
import { todayKey } from './fixtures';

// ── Frames ────────────────────────────────────────────────────────────────
// Real device-ish sizes rather than round numbers, because layout bugs live at
// the sizes people actually have.
const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900, icon: Monitor },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800, icon: Laptop },
  { id: 'tablet', label: 'Tablet', width: 834, height: 1112, icon: Tablet },
  { id: 'phone', label: 'Phone', width: 390, height: 844, icon: Smartphone },
];

const THEMES = [
  { id: 'light', label: 'Light', theme: 'light', tone: 'midnight', icon: Sun },
  { id: 'midnight', label: 'Midnight', theme: 'dark', tone: 'midnight', icon: Moon },
  { id: 'charcoal', label: 'Charcoal', theme: 'dark', tone: 'charcoal', icon: Moon },
];

const BACKDROPS = [
  { id: 'neutral', label: 'Neutral', className: 'bg-gray-200 dark:bg-[#0b1220]' },
  { id: 'plain', label: 'Plain', className: 'bg-white dark:bg-black' },
  {
    id: 'gradient',
    label: 'Gradient',
    className: 'bg-linear-to-br from-blue-100 via-indigo-50 to-white dark:from-blue-950 dark:via-indigo-950 dark:to-black',
  },
];

const viewportById = (id) => VIEWPORTS.find(v => v.id === id) ?? VIEWPORTS[0];

// The stage's p-6 gutter, in pixels. "Fit" has to allow for it, or a frame
// scaled to the measured width overflows by exactly the padding and stops
// being centred.
const STAGE_PADDING = 48;

// ── The stage ─────────────────────────────────────────────────────────────

/**
 * Keeps a broken scenario to itself. Without this, a fixture that no longer
 * matches what a component expects would unmount the whole app — with the
 * storage sandbox still patched in, since the effect that undoes it would
 * never get to run. Worth the class component.
 */
class ScenarioBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // A different scenario deserves a fresh try.
    if (prevProps.scenarioId !== this.props.scenarioId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="grid h-full place-items-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-gray-900">This scenario threw.</p>
          <p className="mt-1.5 text-[13px] text-gray-500">
            Its fixture and the component it mounts have probably drifted apart.
            Pick another scenario, or fix it in <code>src/dev/scenarios.jsx</code>.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-left text-[11px] text-gray-600">
            {String(error?.message || error)}
          </pre>
        </div>
      </div>
    );
  }
}

/**
 * Everything inside the frame. Mounted fresh per scenario (the caller keys it
 * by scenario id) so the seed below always runs against a blank sandbox and
 * the providers re-read it from scratch — which is exactly what a real cold
 * start does.
 */
const ScenarioHost = ({ scenario, withChrome }) => {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    // Device timezone, so a generated 9am block reads as 9am rather than
    // whatever 9am elsewhere happens to be where you're sitting.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    resetSandbox();
    seedBaseline(timezone);
    scenario.seed({ timezone });
    // The extra render IS the mechanism: the providers below must not mount
    // until the seed above has run, or they'd read the previous scenario's
    // world on their way up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [scenario]);

  // The providers below read storage as they mount, so they must not mount
  // until the seed above has run — hence the flag rather than rendering them
  // straight away and re-seeding underneath them.
  if (!ready) return null;

  return (
    <ToastProvider>
      <WorkspaceProvider>
        <TimezoneProvider>
          <UserPreferencesProvider>
            <PomodoroProvider>
              <ScenarioView scenario={scenario} withChrome={withChrome} />
            </PomodoroProvider>
          </UserPreferencesProvider>
        </TimezoneProvider>
      </WorkspaceProvider>
    </ToastProvider>
  );
};

const ScenarioView = ({ scenario, withChrome }) => {
  const { selectedTimezone, isInitialized } = useTimezone();
  if (!isInitialized) return null;

  const key = todayKey(selectedTimezone);
  const api = {
    timezone: selectedTimezone,
    weekly: loadWeeklyTimesheet(),
    entries: loadTimesheetData()[key] ?? [],
  };

  const body = scenario.render(api);

  if (!withChrome) return <div className="h-full overflow-auto bg-gray-50">{body}</div>;

  return (
    <AppLayout
      currentView={scenario.navView ?? 'tracker'}
      onViewChange={() => {}}
      onManageWorkspaces={() => {}}
      onShowChangelog={() => {}}
      hasUnseenChangelog
    >
      {body}
    </AppLayout>
  );
};

// ── Studio ────────────────────────────────────────────────────────────────

const ScreenshotStudio = ({ onClose }) => {
  const { theme, setTheme, darkTone, setDarkTone } = useTheme();

  const [mode, setMode] = useState('gallery');   // 'gallery' | 'stage'
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const [query, setQuery] = useState('');
  const [viewportId, setViewportId] = useState('desktop');
  const [fit, setFit] = useState(true);
  const [chromeOverride, setChromeOverride] = useState(null); // null = scenario's choice
  const [backdropId, setBackdropId] = useState('neutral');
  const [solo, setSolo] = useState(false);
  const [nonce, setNonce] = useState(0);          // bump to re-seed the scenario
  const [showKeys, setShowKeys] = useState(false);

  const stageRef = useRef(null);
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const searchRef = useRef(null);

  const scenario = findScenario(activeId);
  const viewport = viewportById(viewportId);
  const withChrome = chromeOverride ?? scenario.chrome ?? true;
  const backdrop = BACKDROPS.find(b => b.id === backdropId) ?? BACKDROPS[0];

  // The theme the studio shows is the app's real one, driven through the real
  // ThemeContext — which means the frame is styled by the same CSS the app
  // uses, not an approximation. The user's own choice is put back on exit.
  const originalThemeRef = useRef({ theme, darkTone });
  const themeId = theme === 'light' ? 'light' : darkTone === 'charcoal' ? 'charcoal' : 'midnight';
  const applyTheme = (id) => {
    const next = THEMES.find(t => t.id === id) ?? THEMES[0];
    setTheme(next.theme);
    setDarkTone(next.tone);
  };

  // Sandbox for the whole session: entered once here, so switching scenarios
  // is just a reset + re-seed rather than a fresh patch of the storage APIs.
  //
  // Nothing below renders until it's in place. React runs a child's layout
  // effect before its parent's, so a stage mounted on the first pass would
  // seed its fixtures into the user's real storage — the one thing this whole
  // arrangement exists to prevent.
  const [sandboxed, setSandboxed] = useState(false);
  useLayoutEffect(() => {
    const original = originalThemeRef.current;
    // A scenario with a running timer drives the tab title and favicon, just
    // as the real tracker does. Put both back on the way out.
    const originalTitle = document.title;
    enterSandbox();
    // This render is what gates the first mount of anything that touches
    // storage — see the note above.
    setSandboxed(true);
    return () => {
      document.title = originalTitle;
      faviconManager.setActive(false);
      // Deferred by a microtask so every child's cleanup — any of which could
      // still write — happens while the sandbox is up. The theme goes back
      // afterwards, once writes reach real storage again.
      queueMicrotask(() => {
        exitSandbox();
        setTheme(original.theme);
        setDarkTone(original.darkTone);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure the stage so "fit" can scale a 1440px frame into whatever space
  // is left beside the rail.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, solo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SCENARIOS;
    return SCENARIOS.filter(s =>
      `${s.label} ${s.group} ${s.description}`.toLowerCase().includes(q)
    );
  }, [query]);

  const open = useCallback((id) => {
    setActiveId(id);
    const next = findScenario(id);
    if (next.viewport) setViewportId(next.viewport);
    setChromeOverride(null);
    setMode('stage');
  }, []);

  const step = useCallback((delta) => {
    const list = filtered.length > 0 ? filtered : SCENARIOS;
    const at = list.findIndex(s => s.id === activeId);
    const next = list[(at + delta + list.length) % list.length];
    if (next) open(next.id);
  }, [filtered, activeId, open]);

  // Keyboard. Ignored while typing, so the search box still behaves.
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;

      if (e.key === 'Escape') {
        if (typing) return;
        e.preventDefault();
        if (solo) setSolo(false);
        else if (mode === 'stage') setMode('gallery');
        else onClose();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'j': case 'ArrowDown': e.preventDefault(); step(1); break;
        case 'k': case 'ArrowUp': e.preventDefault(); step(-1); break;
        case 'g': e.preventDefault(); setMode('gallery'); break;
        case 'f': e.preventDefault(); setSolo(s => !s); break;
        case 'c': e.preventDefault(); setChromeOverride(v => !(v ?? scenario.chrome ?? true)); break;
        case 'z': e.preventDefault(); setFit(v => !v); break;
        case 'r': e.preventDefault(); setNonce(n => n + 1); break;
        case 'd': {
          e.preventDefault();
          const order = THEMES.map(t => t.id);
          applyTheme(order[(order.indexOf(themeId) + 1) % order.length]);
          break;
        }
        case '?': e.preventDefault(); setShowKeys(v => !v); break;
        case '/': e.preventDefault(); setMode('gallery'); searchRef.current?.focus(); break;
        default: {
          const n = Number(e.key);
          if (Number.isInteger(n) && n >= 1 && n <= VIEWPORTS.length) {
            e.preventDefault();
            setViewportId(VIEWPORTS[n - 1].id);
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // applyTheme is recreated every render but only ever calls the two stable
    // setters from ThemeContext, so leaving it out can't go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, solo, onClose, themeId, scenario]);

  const scale = useMemo(() => {
    if (!fit) return 1;
    if (!stageBox.width || !stageBox.height) return 1;
    const room = {
      width: Math.max(1, stageBox.width - STAGE_PADDING),
      height: Math.max(1, stageBox.height - STAGE_PADDING),
    };
    return Math.min(1, room.width / viewport.width, room.height / viewport.height);
  }, [fit, stageBox, viewport]);

  const frame = (
    <div
      className="shrink-0 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 kronos-studio-frame"
      style={{
        width: viewport.width,
        height: viewport.height,
        // Any transform makes this element the containing block for the
        // `fixed` elements inside it — which is how the app's modals, toasts
        // and dropdowns end up framed by the device instead of by the studio.
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <ScenarioBoundary scenarioId={`${scenario.id}:${nonce}`}>
        <ScenarioHost
          key={`${scenario.id}:${nonce}`}
          scenario={scenario}
          withChrome={withChrome}
        />
      </ScenarioBoundary>
    </div>
  );

  const stage = (
    <div
      ref={stageRef}
      className={`relative flex-1 overflow-auto p-6 ${backdrop.className}`}
    >
      {/* Centred both ways, and still scrollable at 1:1 where the frame is
          bigger than the stage: sizing this to max-content with a floor of the
          stage's own size means centring only ever happens in the spare room,
          so an oversized frame starts at its top-left corner instead of having
          its first rows and columns pushed out of reach. */}
      <div className="flex h-max min-h-full w-max min-w-full items-center justify-center">
        <div
          className="shrink-0"
          style={{ width: viewport.width * scale, height: viewport.height * scale }}
        >
          {frame}
        </div>
      </div>
    </div>
  );

  // One blank frame while the sandbox goes up. See the layout effect above.
  if (!sandboxed) return <div className="fixed inset-0 z-200 bg-gray-100 dark:bg-[#0b1220]" />;

  if (solo) {
    return (
      <div className="fixed inset-0 z-200 flex flex-col">
        {stage}
        <button
          type="button"
          onClick={() => setSolo(false)}
          className="fixed bottom-4 left-1/2 z-210 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-gray-900 opacity-40 hover:opacity-100"
        >
          Esc to leave capture mode
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-200 flex flex-col bg-gray-100 dark:bg-[#0b1220]">
      {/* Title bar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200/80 bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={() => setMode('gallery')}
          className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
            mode === 'gallery' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Screenshot Studio
        </button>

        <span className="hidden text-[13px] text-gray-400 sm:block">
          {SCENARIOS.length} scenarios · sandboxed, nothing here touches your data
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowKeys(v => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </header>

      {mode === 'gallery' ? (
        <Gallery
          scenarios={filtered}
          query={query}
          onQuery={setQuery}
          searchRef={searchRef}
          activeId={activeId}
          onOpen={open}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Rail */}
          <nav className="hidden w-64 shrink-0 overflow-y-auto border-r border-gray-200/80 bg-white py-3 lg:block">
            {SCENARIO_GROUPS.map(group => {
              const items = filtered.filter(s => s.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-3">
                  <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                    {group}
                  </p>
                  <ul>
                    {items.map(s => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => open(s.id)}
                          aria-current={s.id === activeId ? 'true' : undefined}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            s.id === activeId
                              ? 'bg-blue-50 font-medium text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <Toolbar
              scenario={scenario}
              viewportId={viewportId}
              onViewport={setViewportId}
              themeId={themeId}
              onTheme={applyTheme}
              withChrome={withChrome}
              onChrome={() => setChromeOverride(!withChrome)}
              fit={fit}
              onFit={() => setFit(v => !v)}
              backdropId={backdropId}
              onBackdrop={setBackdropId}
              onReseed={() => setNonce(n => n + 1)}
              onSolo={() => setSolo(true)}
              onStep={step}
              scale={scale}
            />
            {stage}
          </div>
        </div>
      )}

      {showKeys && <Shortcuts onClose={() => setShowKeys(false)} />}

      {/* The app's layout is written for a real viewport; inside a frame the
          frame IS the viewport, so screen-height utilities have to mean the
          frame's height instead of the window's. */}
      <style>{`
        .kronos-studio-frame :where(.h-screen) { height: 100% !important; }
        .kronos-studio-frame :where(.min-h-screen) { min-height: 100% !important; }
      `}</style>
    </div>
  );
};

// ── Gallery ───────────────────────────────────────────────────────────────

const Gallery = ({ scenarios, query, onQuery, searchRef, activeId, onOpen }) => (
  <div className="flex-1 overflow-y-auto">
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter scenarios — reports, empty, modal…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-xs placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {scenarios.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center text-sm text-gray-500">
          Nothing matches “{query.trim()}”.
        </p>
      )}

      {SCENARIO_GROUPS.map(group => {
        const items = scenarios.filter(s => s.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="mb-8">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {group}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(s => {
                const vp = viewportById(s.viewport ?? 'desktop');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpen(s.id)}
                    className={`group flex h-full flex-col rounded-2xl border bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      s.id === activeId ? 'border-blue-300 ring-2 ring-blue-500/15' : 'border-gray-200/80'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                        {s.group}
                      </span>
                      {s.chrome === false && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-600">
                          full screen
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <vp.icon className="h-3 w-3" />
                        {vp.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                      {s.label}
                    </h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{s.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  </div>
);

// ── Toolbar ───────────────────────────────────────────────────────────────

const SegButton = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
      active ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const Toolbar = ({
  scenario, viewportId, onViewport, themeId, onTheme, withChrome, onChrome,
  fit, onFit, backdropId, onBackdrop, onReseed, onSolo, onStep, scale,
}) => (
  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200/80 bg-white px-4 py-2">
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Previous scenario"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="Next scenario"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>

    <div className="mr-1 min-w-0">
      <p className="truncate text-sm font-semibold text-gray-900">{scenario.label}</p>
      <p className="truncate text-[11px] text-gray-400">{scenario.group}</p>
    </div>

    <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5">
      {VIEWPORTS.map((v, i) => (
        <SegButton
          key={v.id}
          active={v.id === viewportId}
          onClick={() => onViewport(v.id)}
          title={`${v.label} — ${v.width}×${v.height} (${i + 1})`}
        >
          <v.icon className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{v.label}</span>
        </SegButton>
      ))}
    </div>

    <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5">
      {THEMES.map(t => (
        <SegButton key={t.id} active={t.id === themeId} onClick={() => onTheme(t.id)} title={`${t.label} (d)`}>
          <t.icon className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{t.label}</span>
        </SegButton>
      ))}
    </div>

    <div className="flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5">
      {BACKDROPS.map(b => (
        <SegButton key={b.id} active={b.id === backdropId} onClick={() => onBackdrop(b.id)} title={`${b.label} backdrop`}>
          <span className="hidden xl:inline">{b.label}</span>
          <span className="xl:hidden">{b.label.slice(0, 1)}</span>
        </SegButton>
      ))}
    </div>

    <div className="ml-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={onChrome}
        title="Sidebar & header (c)"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
          withChrome
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'
        }`}
      >
        <PanelsTopLeft className="h-3.5 w-3.5" />
        Chrome
      </button>
      <button
        type="button"
        onClick={onFit}
        title="Fit to window / 1:1 (z)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        {fit ? `Fit ${Math.round(scale * 100)}%` : '1:1'}
      </button>
      <button
        type="button"
        onClick={onReseed}
        title="Rebuild this scenario (r)"
        className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-900"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSolo}
        title="Capture mode — hide the studio (f)"
        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-gray-800"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Capture
      </button>
    </div>
  </div>
);

// ── Shortcuts ─────────────────────────────────────────────────────────────

const KEYS = [
  ['J / ↓', 'Next scenario'],
  ['K / ↑', 'Previous scenario'],
  ['G', 'Back to the gallery'],
  ['/', 'Filter scenarios'],
  ['1–4', 'Desktop · Laptop · Tablet · Phone'],
  ['D', 'Cycle light → midnight → charcoal'],
  ['C', 'Sidebar & header on/off'],
  ['Z', 'Fit to window / 1:1'],
  ['R', 'Rebuild the scenario'],
  ['F', 'Capture mode (hide the studio)'],
  ['Esc', 'Back, then close'],
];

const Shortcuts = ({ onClose }) => (
  <div className="fixed inset-0 z-210 grid place-items-center bg-black/40 p-4" onClick={onClose}>
    <div
      className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Keyboard</h3>
      <dl className="space-y-1.5">
        {KEYS.map(([key, what]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-gray-500">{what}</dt>
            <dd>
              <kbd className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-500">
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);

export default ScreenshotStudio;
