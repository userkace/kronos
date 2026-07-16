import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatInTimeZone } from 'date-fns-tz';
import { CloudOff, Monitor, Cloud, GitMerge } from 'lucide-react';
import { loadTimezoneForWorkspace } from '../utils/storage';

// Shown when signing in finds the same document changed both locally and in the
// cloud. Object documents (invoice settings, colors, time entries) are diffed
// field-by-field so the user keeps the right value per field; scalar documents
// offer a single this-device / cloud choice.

// Stored times are UTC instants — show them in the given timezone (falling
// back to the raw UTC HH:MM on a malformed timestamp).
const fmtTime = (iso, timezone) => {
  try {
    return formatInTimeZone(new Date(iso), timezone, 'HH:mm');
  } catch {
    return iso.slice(11, 16);
  }
};

// Format a single field value compactly for display.
const fmtValue = (v, timezone) => {
  if (v === undefined) return '(not set)';
  if (v === '') return '(empty)';
  if (Array.isArray(v)) return `${v.length} entr${v.length === 1 ? 'y' : 'ies'}`;
  if (v && typeof v === 'object') {
    // Time entry: show "description · HH:MM–HH:MM" rather than raw JSON.
    if (v.startTime) {
      const desc = (v.description || '').trim() || 'Untitled';
      const a = fmtTime(v.startTime, timezone);
      const b = v.endTime ? fmtTime(v.endTime, timezone) : 'running';
      return `${desc} · ${a}–${b}`;
    }
    const s = JSON.stringify(v);
    return s.length > 90 ? `${s.slice(0, 90)}…` : s;
  }
  return String(v);
};

// Whole-value preview for scalar (non-object) documents.
const previewScalar = (kind, value, timezone) => {
  try {
    if (kind === 'idb') return fmtValue(value, timezone);
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    return fmtValue(parsed, timezone);
  } catch {
    return '—';
  }
};

// One side of a choice (a selectable value cell).
const Choice = ({ selected, onClick, icon: Icon, title, text }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left rounded-lg border p-2.5 transition-colors ${
      selected
        ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20'
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}
  >
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3.5 h-3.5 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className={`text-xs font-medium ${selected ? 'text-blue-700' : 'text-gray-600'}`}>{title}</span>
    </div>
    <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">{text}</p>
  </button>
);

const SyncConflictModal = ({ conflicts, onResolve }) => {
  // Default every choice to "this device" — the safest non-destructive default
  // for the machine the user is actively working on. Object conflicts get a
  // per-field map; scalar conflicts get a single value.
  const [choices, setChoices] = useState(() => {
    const init = {};
    for (const c of conflicts) {
      init[c.id] = c.fields
        ? Object.fromEntries(c.fields.map(f => [f.key, 'local']))
        : 'local';
    }
    return init;
  });

  const setAll = (pick) => {
    const next = {};
    for (const c of conflicts) {
      next[c.id] = c.fields
        ? Object.fromEntries(c.fields.map(f => [f.key, pick]))
        : pick;
    }
    setChoices(next);
  };

  const setConflictAll = (c, pick) =>
    setChoices(prev => ({
      ...prev,
      [c.id]: c.fields ? Object.fromEntries(c.fields.map(f => [f.key, pick])) : pick,
    }));

  const setField = (id, key, pick) =>
    setChoices(prev => ({ ...prev, [id]: { ...prev[id], [key]: pick } }));

  const setScalar = (id, pick) => setChoices(prev => ({ ...prev, [id]: pick }));

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
                These changed both on this device and in your account. Pick which value to keep — only the
                differing fields are shown.
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
          {conflicts.map(c => {
            // Each conflict may belong to a different workspace; show its times
            // in that workspace's timezone (device-local when none is saved).
            const tz = loadTimezoneForWorkspace(c.wsId);
            return (
            <div key={c.id} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-sm font-semibold text-gray-900">{c.label}</span>
                  {c.workspaceName && (
                    <span className="ml-2 text-xs text-gray-400">· {c.workspaceName}</span>
                  )}
                </div>
                {c.fields && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConflictAll(c, 'local')}
                      className="text-[11px] font-medium text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      All device
                    </button>
                    <span className="text-[11px] text-gray-300">·</span>
                    <button
                      onClick={() => setConflictAll(c, 'cloud')}
                      className="text-[11px] font-medium text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      All cloud
                    </button>
                  </div>
                )}
              </div>

              {c.fields ? (
                // Field-level diff: one row per changed field.
                <div className="space-y-3">
                  {c.fields.map(f => {
                    const pick = (choices[c.id] || {})[f.key] || 'local';
                    return (
                      <div key={f.key}>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">{f.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Choice
                            selected={pick === 'local'}
                            onClick={() => setField(c.id, f.key, 'local')}
                            icon={Monitor}
                            title="This device"
                            text={fmtValue(f.localValue, tz)}
                          />
                          <Choice
                            selected={pick === 'cloud'}
                            onClick={() => setField(c.id, f.key, 'cloud')}
                            icon={Cloud}
                            title="Cloud"
                            text={fmtValue(f.cloudValue, tz)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Scalar document: single whole-value choice.
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Choice
                    selected={choices[c.id] === 'local'}
                    onClick={() => setScalar(c.id, 'local')}
                    icon={Monitor}
                    title="This device"
                    text={previewScalar(c.kind, c.localValue, tz)}
                  />
                  <Choice
                    selected={choices[c.id] === 'cloud'}
                    onClick={() => setScalar(c.id, 'cloud')}
                    icon={Cloud}
                    title="Cloud"
                    text={previewScalar(c.kind, c.cloudValue, tz)}
                  />
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <CloudOff className="w-3.5 h-3.5" /> Unchosen values are overwritten.
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
