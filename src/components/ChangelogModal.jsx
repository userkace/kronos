import { Sparkles, X } from 'lucide-react';
import { CHANGE_TYPES } from '../data/changelog';

const TONE_CLASSES = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
};

const ChangeBadge = ({ type }) => {
  const meta = CHANGE_TYPES[type] || { label: type, tone: 'blue' };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${TONE_CLASSES[meta.tone] || TONE_CLASSES.blue}`}>
      {meta.label}
    </span>
  );
};

const ChangelogModal = ({ entries, onDismiss }) => {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onDismiss}
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">What's new</h2>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {entries.map(entry => (
            <section key={entry.version}>
              <header className="flex items-baseline justify-between mb-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {entry.title}
                </h3>
                <span className="text-xs text-gray-500">{entry.date}</span>
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

        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
