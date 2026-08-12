import { format, parse, isValid } from 'date-fns';
import { CHANGE_TYPES } from '../data/changelog';

// Presentation shared by the two places a release is rendered: the "What's new"
// modal (ChangelogModal) and Settings → About → Release Notes. Keeping the badge
// and the entry body here means a change to how a release reads only has to be
// made once, and the two never drift apart.

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
  green: 'bg-green-50 text-green-700 ring-1 ring-green-200/80',
  blue:  'bg-blue-50  text-blue-700  ring-1 ring-blue-200/80',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80',
  red:   'bg-red-50   text-red-700   ring-1 ring-red-200/80',
};

export const ChangeBadge = ({ type }) => {
  const meta = CHANGE_TYPES[type] || { label: type, tone: 'blue' };
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[meta.tone] || TONE_CLASSES.blue}`}>
      {meta.label}
    </span>
  );
};

/**
 * One release: version, title, date, and its list of changes. Deliberately
 * unwrapped — the caller supplies the element around it (a motion.section in
 * the modal, a plain list item in Settings).
 */
export const ChangelogEntryBody = ({ entry }) => (
  <>
    <header className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-semibold tabular-nums text-gray-400 shrink-0">
          v{entry.version}
        </span>
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight truncate">
          {entry.title}
        </h3>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
        {formatChangelogDate(entry.date)}
      </span>
    </header>
    <ul className="space-y-2.5">
      {entry.changes.map((change, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-600">
          <ChangeBadge type={change.type} />
          <span className="flex-1 leading-relaxed">{change.description}</span>
        </li>
      ))}
    </ul>
  </>
);
