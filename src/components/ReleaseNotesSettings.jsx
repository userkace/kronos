import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, ChevronDown } from 'lucide-react';
import { CHANGELOG } from '../data/changelog';
import { ChangelogEntryBody } from './ChangelogEntries';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

// How many releases are on screen before you ask for the rest. The whole
// history is long enough to bury everything below it in the About group, and
// the recent few are what people came for.
const COLLAPSED_COUNT = 3;

/**
 * Settings → About → Release Notes. The same history the "What's new" modal
 * shows, readable in place: the modal only appears after an update (or from the
 * header bell), so this is where you go to look something up on purpose.
 */
const ReleaseNotesSettings = () => {
  const [expanded, setExpanded] = useState(false);
  const { getTransition } = useMotionPreferences();

  const hasMore = CHANGELOG.length > COLLAPSED_COUNT;
  const hiddenCount = CHANGELOG.length - COLLAPSED_COUNT;

  // The releases beyond the first few unfold rather than appearing all at once,
  // so it reads as the list growing instead of the page jumping under you.
  const revealTransition = getTransition({ duration: 0.3, ease: 'easeOut' });

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Sparkles className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-gray-900 tracking-tight">Release Notes</h4>
          <p className="text-[13px] text-gray-500">
            Everything that's changed in Kronos, newest first.
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {CHANGELOG.slice(0, COLLAPSED_COUNT).map(entry => (
          <section key={entry.version} className="py-5 first:pt-0">
            <ChangelogEntryBody entry={entry} />
          </section>
        ))}

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              className="overflow-hidden"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={revealTransition}
            >
              <div className="divide-y divide-gray-100">
                {CHANGELOG.slice(COLLAPSED_COUNT).map(entry => (
                  <section key={entry.version} className="py-5">
                    <ChangelogEntryBody entry={entry} />
                  </section>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors duration-150 hover:text-gray-700"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded
              ? 'Show fewer releases'
              : `Show ${hiddenCount} older release${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReleaseNotesSettings;
