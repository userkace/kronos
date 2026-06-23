import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { CHANGE_TYPES } from '../data/changelog';

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

const ChangeBadge = ({ type }) => {
  const meta = CHANGE_TYPES[type] || { label: type, tone: 'blue' };
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[meta.tone] || TONE_CLASSES.blue}`}>
      {meta.label}
    </span>
  );
};

const ChangelogModal = ({ entries, onDismiss }) => {
  const prefersReduced = useReducedMotion();

  if (!entries || entries.length === 0) return null;

  // Panel rises and fades in (bottom-sheet on mobile, centered card on
  // desktop); the entry sections stagger in just behind it. Reduced-motion
  // users get a plain cross-fade with no movement or scale. Mirrors the
  // workspace manager modal.
  const panelVariants = prefersReduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        visible: {
          opacity: 1, y: 0, scale: 1,
          transition: { type: 'spring', stiffness: 380, damping: 32, staggerChildren: 0.035, delayChildren: 0.04 },
        },
        exit: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15, ease: 'easeIn' } },
      };

  const sectionVariants = prefersReduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

  // Portal to <body>: keeps the fixed overlay anchored to the viewport rather
  // than any transformed ancestor, matching the workspace manager modal.
  return createPortal(
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onDismiss}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />

      <motion.div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-200/60 w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] sm:max-h-[85vh] flex flex-col"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 leading-none mb-1">
                Release notes
              </p>
              <h2 className="font-display text-base font-semibold text-gray-900 leading-none">
                What's new
              </h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 -m-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {entries.map(entry => (
            <motion.section key={entry.version} variants={sectionVariants}>
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
            </motion.section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button
            onClick={onDismiss}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 transition-colors duration-150"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default ChangelogModal;
