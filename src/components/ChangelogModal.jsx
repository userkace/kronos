import { Sparkles, X } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { CHANGE_TYPES } from '../data/changelog';

// Format a yyyy-MM-dd string as "Month Day, Year" without crossing a timezone
// boundary (parseISO would treat the value as UTC midnight, which can shift
// the displayed day in west-of-UTC zones). On unparseable input we fall back
// to the raw string so the modal never blanks out.
const formatChangelogDate = (raw) => {
  if (!raw) return '';
  try {
    const d = parse(raw, 'yyyy-MM-dd', new Date());
    return isValid(d) ? format(d, 'MMMM d, yyyy') : raw;
  } catch {
    return raw;
  }
};

const TONE_CLASSES = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

const ChangeBadge = ({ type }) => {
  const meta = CHANGE_TYPES[type] || { label: type, tone: 'blue' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[meta.tone] || TONE_CLASSES.blue}`}>
      {meta.label}
    </span>
  );
};

const ChangelogModal = ({ entries, onDismiss }) => {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onDismiss}
      />

      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200/60 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">What's new</h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 -m-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {entries.map(entry => (
            <section key={entry.version}>
              <header className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="text-base font-semibold text-gray-900 tracking-tight min-w-0 wrap-break-word">
                  {entry.title}
                </h3>
                <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                  {formatChangelogDate(entry.date)}
                </span>
              </header>
              <ul className="space-y-2">
                {entry.changes.map((change, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <ChangeBadge type={change.type} />
                    <span className="flex-1">{change.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg shadow-xs transition-colors duration-150"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
