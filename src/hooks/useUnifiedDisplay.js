import { useMemo } from 'react';
import { insertActiveEntryChronologically } from '../utils/entryUtils';

/**
 * Optimized helper function to create chronological sequence with breaks
 */
const createChronologicalWithBreaks = (entries, calculateBreakTime) => {
  const chronologicalWithBreaks = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Add break before this entry if there's a previous entry
    if (i > 0) {
      const previousEntry = entries[i - 1];
      const breakTime = calculateBreakTime(entry, previousEntry);
      if (breakTime) {
        chronologicalWithBreaks.push({
          type: 'break',
          data: breakTime,
          beforeEntryId: entry.id,
          afterEntryId: previousEntry.id,
          breakKey: `break-${previousEntry.id}-${entry.id}`
        });
      }
    }

    chronologicalWithBreaks.push({
      type: 'entry',
      data: entry
    });
  }

  return chronologicalWithBreaks;
};

/**
 * Optimized helper function to reverse sequence while preserving break positions
 */
const createReversedSequence = (chronologicalWithBreaks, entriesForDisplay) => {
  const reversedSequence = [];
  const entryPositions = new Map();

  // Map entry positions in chronological order
  chronologicalWithBreaks.forEach((item, index) => {
    if (item.type === 'entry') {
      entryPositions.set(item.data.id, index);
    }
  });

  // Sort entries by display order (newest first)
  const displayEntries = [...entriesForDisplay].reverse();

  // Build reversed sequence
  displayEntries.forEach(entry => {
    const chronologicalIndex = entryPositions.get(entry.id);
    if (chronologicalIndex !== undefined) {
      // Find segment start (beginning of breaks before this entry)
      let segmentStart = chronologicalIndex;
      while (segmentStart > 0 &&
             chronologicalWithBreaks[segmentStart - 1].type !== 'entry') {
        segmentStart--;
      }

      // Add segment in reverse order
      for (let i = chronologicalIndex; i >= segmentStart; i--) {
        reversedSequence.push(chronologicalWithBreaks[i]);
      }
    }
  });

  return reversedSequence;
};

/**
 * Custom hook to compute unified display of entries and breaks
 * Extracted from DailyTracker component for better testability and maintainability
 * Optimized for performance with reduced complexity
 *
 * @param {Object|null} activeEntry - Currently active timer entry or null if no active entry
 * @param {Array<Object>} selectedDateEntries - Array of timer entries for the selected date
 * @param {string} sortOrder - Sort order for display ('asc' for chronological, 'desc' for reverse chronological)
 * @param {boolean} showBreaks - Whether to include break periods between entries in the display
 * @param {Function} calculateBreakTime - Function to calculate break time between two entries
 * @param {Object} calculateBreakTime.entry - Current entry for break calculation
 * @param {Object} calculateBreakTime.previousEntry - Previous entry for break calculation
 * @returns {Array<Object>} Unified display array containing entry and break objects with type and data properties
 *
 * @note IMPORTANT: The calculateBreakTime function MUST be wrapped in useCallback in the parent component
 * to prevent unnecessary recalculations of the useMemo. If not wrapped, the hook will still work
 * but will have significant performance implications as the useMemo will recalculate on every render.
 */
export const useUnifiedDisplay = (
  activeEntry,
  selectedDateEntries,
  sortOrder,
  showBreaks,
  calculateBreakTime
) => {
  return useMemo(() => {
    const unifiedDisplay = [];

    // Filter completed entries once
    const completedEntries = selectedDateEntries.filter(entry => !entry.isActive && entry.endTime);

    // Handle active entry by inserting it in correct chronological position using shared utility
    const allEntriesChronological = insertActiveEntryChronologically(completedEntries, activeEntry);

    // Create chronological sequence with breaks for all entries
    const chronologicalWithBreaks = createChronologicalWithBreaks(allEntriesChronological, calculateBreakTime);

    // Separate active entry and breaks from completed entries for display
    let activeEntryDisplay = [];
    let completedEntriesDisplay = [];

    chronologicalWithBreaks.forEach(item => {
      if (item.type === 'entry' && item.data.isActive) {
        activeEntryDisplay.push({
          type: 'active',
          data: item.data
        });
      } else if (item.type === 'break') {
        // Only include breaks that are not associated with the active entry
        // Breaks with beforeEntryId or afterEntryId matching activeEntry?.id are excluded
        if (item.beforeEntryId !== activeEntry?.id && item.afterEntryId !== activeEntry?.id) {
          completedEntriesDisplay.push(item);
        }
      } else {
        completedEntriesDisplay.push(item);
      }
    });

    // Apply display order to completed entries only
    let displaySequence;
    if (sortOrder === 'desc') {
      displaySequence = createReversedSequence(completedEntriesDisplay, allEntriesChronological);
    } else {
      displaySequence = completedEntriesDisplay;
    }

    // Filter out breaks if showBreaks is false
    if (!showBreaks) {
      displaySequence = displaySequence.filter(item => item.type !== 'break');
    }

    // Combine active entry (always first) with completed entries display
    unifiedDisplay.push(...activeEntryDisplay, ...displaySequence);

    return unifiedDisplay;
  }, [activeEntry, selectedDateEntries, sortOrder, showBreaks, calculateBreakTime]);
};
