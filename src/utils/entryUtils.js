/**
 * Utility functions for handling time entries
 */

/**
 * Inserts an active entry into the correct chronological position among completed entries
 * @param {Array} completedEntries - Array of completed entries (filtered to exclude active entries)
 * @param {Object} activeEntry - The active entry to insert (can be null/undefined)
 * @param {boolean} skipSorting - If true, assumes completedEntries are already sorted chronologically and skips sorting
 * @returns {Array} Array with all entries in chronological order
 */
export const insertActiveEntryChronologically = (completedEntries, activeEntry, skipSorting = false) => {
  // Sort completed entries chronologically unless skipSorting is true
  const chronologicalEntries = skipSorting 
    ? completedEntries 
    : [...completedEntries].sort((a, b) =>
        new Date(a.startTime) - new Date(b.startTime)
      );

  // If no active entry, return sorted completed entries
  if (!activeEntry) {
    return chronologicalEntries;
  }

  // Find the correct position to insert active entry chronologically
  const activeStartTime = new Date(activeEntry.startTime);
  let insertIndex = chronologicalEntries.findIndex(entry =>
    new Date(entry.startTime) > activeStartTime
  );

  // If no entry starts after active entry, add to the end
  if (insertIndex === -1) {
    insertIndex = chronologicalEntries.length;
  }

  // Create a new array with the active entry inserted at the correct position
  const allEntriesChronological = [...chronologicalEntries];
  allEntriesChronological.splice(insertIndex, 0, activeEntry);

  return allEntriesChronological;
};
