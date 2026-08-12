import { Sliders, Palette, Cloud, Database, Info } from 'lucide-react';
import { SETTINGS_CATEGORIES } from '../utils/settingsSearch';

const CATEGORY_ICONS = {
  general: Sliders,
  appearance: Palette,
  account: Cloud,
  data: Database,
  about: Info,
};

/**
 * The category rail for Settings — a sticky list on desktop, a scrollable row
 * of chips on narrow screens.
 *
 * While a search is running the rail stops being the thing that decides what's
 * on screen (results are shown across every category, as they always were), so
 * it switches to reporting where the matches are and picking one clears the
 * search rather than intersecting with it — an intersection can dead-end on
 * "no matches here" while matches sit in the group you can't see.
 */
const SettingsNav = ({ activeCategory, onSelect, isSearching, matchCounts }) => {
  const itemState = (id) => {
    const isActive = !isSearching && id === activeCategory;
    const count = matchCounts?.[id] ?? 0;
    return { isActive, count, dimmed: isSearching && count === 0 };
  };

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Settings categories"
        className="hidden lg:block lg:sticky lg:top-20 w-52 shrink-0"
      >
        <ul className="space-y-0.5">
          {SETTINGS_CATEGORIES.map(({ id, label }) => {
            const Icon = CATEGORY_ICONS[id];
            const { isActive, count, dimmed } = itemState(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : `text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 ${dimmed ? 'opacity-45' : ''}`
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="flex-1 truncate text-sm font-medium">{label}</span>
                  {isSearching && count > 0 && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Narrow-screen chips. -mx-6/px-6 lets the row bleed to the page edges
          so it reads as scrollable rather than clipped. */}
      <div className="lg:hidden -mx-6 mb-5 overflow-x-auto px-6 pb-1">
        <div
          role="tablist"
          aria-label="Settings categories"
          className="flex w-max items-center gap-1.5"
        >
          {SETTINGS_CATEGORIES.map(({ id, label }) => {
            const Icon = CATEGORY_ICONS[id];
            const { isActive, count, dimmed } = itemState(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                    : `border-gray-200 bg-white text-gray-600 shadow-xs hover:border-gray-300 hover:text-gray-900 ${dimmed ? 'opacity-45' : ''}`
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {isSearching && count > 0 && (
                  <span className="tabular-nums text-[11px] font-semibold text-gray-400">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SettingsNav;
