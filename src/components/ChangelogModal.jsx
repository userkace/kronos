import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X, Github } from 'lucide-react';
import { ChangelogEntryBody } from './ChangelogEntries';

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
              <ChangelogEntryBody entry={entry} />
            </motion.section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <a
            href="https://github.com/userkace/kronos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150"
          >
            <Github className="w-3.5 h-3.5" />
            userkace/kronos
          </a>
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
