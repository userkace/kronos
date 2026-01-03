import { useMemo } from 'react';

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
const createReversedSequence = (chronologicalWithBreaks, completedEntries) => {
  const reversedSequence = [];
  const entryPositions = new Map();
  
  // Map entry positions in chronological order
  chronologicalWithBreaks.forEach((item, index) => {
    if (item.type === 'entry') {
      entryPositions.set(item.data.id, index);
    }
  });
  
  // Sort entries by display order (newest first)
  const displayEntries = [...completedEntries].reverse();
  
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
    
    // Handle active entry and its break
    if (activeEntry) {
      unifiedDisplay.push({
        type: 'active',
        data: activeEntry
      });
      
      // Add break between active entry and last completed entry
      if (completedEntries.length > 0) {
        const lastCompleted = completedEntries[completedEntries.length - 1];
        const breakTimeBetweenActiveAndLast = calculateBreakTime(activeEntry, lastCompleted);
        if (breakTimeBetweenActiveAndLast) {
          unifiedDisplay.push({
            type: 'break',
            data: breakTimeBetweenActiveAndLast,
            beforeEntryId: activeEntry.id,
            afterEntryId: lastCompleted.id,
            breakKey: `active-break-${activeEntry.id}-${lastCompleted.id}`
          });
        }
      }
    }

    // Sort completed entries chronologically
    const chronologicalEntries = [...completedEntries].sort((a, b) => 
      new Date(a.startTime) - new Date(b.startTime)
    );

    // Create chronological sequence with breaks
    const chronologicalWithBreaks = createChronologicalWithBreaks(chronologicalEntries, calculateBreakTime);

    // Apply display order
    if (sortOrder === 'desc') {
      const reversedSequence = createReversedSequence(chronologicalWithBreaks, completedEntries);
      unifiedDisplay.push(...reversedSequence);
    } else {
      unifiedDisplay.push(...chronologicalWithBreaks);
    }

    return unifiedDisplay;
  }, [activeEntry, selectedDateEntries, sortOrder, showBreaks, calculateBreakTime]);
};
