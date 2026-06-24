import { useState } from 'react';
import { motion } from 'framer-motion';
import { CloudOff, Monitor, Cloud, GitMerge } from 'lucide-react';

// Shown when signing in finds the same document changed both locally and in the
// cloud. The user picks which copy to keep per item (per the product decision to
// ask on conflict rather than silently last-write-wins).

const previewOf = (kind, value) => {
  try {
    if (kind === 'idb') {
      const days = value && typeof value === 'object' ? Object.keys(value).length : 0;
      const entries = value && typeof value === 'object'
        ? Object.values(value).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0)
        : 0;
      return `${days} day${days === 1 ? '' : 's'}, ${entries} entr${entries === 1 ? 'y' : 'ies'}`;
    }
    // ls values are opaque strings; pretty-print JSON when possible.
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const s = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  } catch {
    return '—';
  }
};

const SyncConflictModal = ({ conflicts, onResolve }) => {
  // Default every conflict to "this device" — the safest non-destructive choice
  // for the machine the user is actively working on.
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(conflicts.map(c => [c.id, 'local']))
  );

  const setAll = (pick) =>
    setChoices(Object.fromEntries(conflicts.map(c => [c.id, pick])));

  const setOne = (id, pick) => setChoices(prev => ({ ...prev, [id]: pick }));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <GitMerge className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-gray-900">Resolve sync conflicts</h3>
              <p className="text-sm text-gray-500">
                These items changed both on this device and in your account. Choose which copy to keep.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setAll('local')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" /> Use this device for all
            </button>
            <button
              onClick={() => setAll('cloud')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
            >
              <Cloud className="w-3.5 h-3.5" /> Use cloud for all
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {conflicts.map(c => (
            <div key={c.id} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3">
                <span className="text-sm font-semibold text-gray-900">{c.label}</span>
                {c.workspaceName && (
                  <span className="ml-2 text-xs text-gray-400">· {c.workspaceName}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { pick: 'local', icon: Monitor, title: 'This device', value: c.localValue },
                  { pick: 'cloud', icon: Cloud, title: 'Cloud', value: c.cloudValue },
                ].map(({ pick, icon: Icon, title, value }) => {
                  const selected = choices[c.id] === pick;
                  return (
                    <button
                      key={pick}
                      onClick={() => setOne(c.id, pick)}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`text-xs font-medium ${selected ? 'text-blue-700' : 'text-gray-600'}`}>{title}</span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono break-all leading-relaxed">
                        {previewOf(c.kind, value)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <CloudOff className="w-3.5 h-3.5" /> The unchosen copy will be overwritten.
          </p>
          <button
            onClick={() => onResolve(choices)}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 hover:bg-blue-500 active:bg-blue-700 transition-colors"
          >
            Keep selected & sync
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SyncConflictModal;
