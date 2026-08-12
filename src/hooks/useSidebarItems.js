import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  NAV_ITEMS,
  NAV_ITEMS_BY_ID,
  DEFAULT_NAV_ORDER,
  isNavItemLocked,
} from '../constants/navigation';
import {
  loadSidebarItems,
  saveSidebarItems,
  SIDEBAR_ITEMS_KEY,
} from '../utils/storage';

// Bring a stored order in line with the views this build actually ships:
// unknown ids are dropped (a view was removed, or the layout came from a newer
// release) and views absent from the stored order are inserted just after the
// last neighbour they ship behind by default — so adding a view to NAV_ITEMS
// slots it into a customized sidebar near where it belongs instead of always
// landing at the bottom, and never goes missing entirely.
const reconcileOrder = (storedOrder) => {
  // Deduped as well as filtered: a repeated id would render the same nav
  // button twice and collide on its React key.
  const result = [...new Set(storedOrder)].filter(id => NAV_ITEMS_BY_ID.has(id));

  DEFAULT_NAV_ORDER.forEach((id, defaultIndex) => {
    if (result.includes(id)) return;
    let insertAt = 0;
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const anchor = result.indexOf(DEFAULT_NAV_ORDER[i]);
      if (anchor !== -1) {
        insertAt = anchor + 1;
        break;
      }
    }
    result.splice(insertAt, 0, id);
  });

  return result;
};

const reconcile = ({ order, hidden }) => ({
  order: reconcileOrder(order),
  // Locked items are filtered out rather than trusted: a hand-edited or
  // stale value must not be able to hide the way back to this setting.
  hidden: hidden.filter(id => NAV_ITEMS_BY_ID.has(id) && !isNavItemLocked(id)),
});

const isDefaultLayout = ({ order, hidden }) =>
  hidden.length === 0 &&
  order.length === DEFAULT_NAV_ORDER.length &&
  order.every((id, i) => id === DEFAULT_NAV_ORDER[i]);

// ── The store ─────────────────────────────────────────────────────────────
// One module-level snapshot shared by every component that reads the layout,
// rather than a copy per component kept in step through storage notifications.
// The Settings editor and the sidebar it's rendered inside must never disagree,
// and an in-tab notification is the wrong thing to depend on for that: the
// localStorage patching in storageEvents.js can be defeated by anything that
// reassigns localStorage.setItem after it (another library, a browser
// extension), which would leave the editor working, the value saved, and the
// sidebar stale until the next reload. A shared snapshot can't drift.
let snapshot = reconcile(loadSidebarItems());
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Must be referentially stable between writes — useSyncExternalStore compares
// snapshots by identity and would loop forever on a fresh object each call.
const getSnapshot = () => snapshot;

const publish = (next) => {
  snapshot = next;
  listeners.forEach(listener => listener());
};

const write = (next) => {
  const reconciled = reconcile(next);
  saveSidebarItems(reconciled);
  publish(reconciled);
};

// Other tabs still need picking up, and the native storage event is delivered
// for those without any patching. `key === null` is a localStorage.clear().
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== SIDEBAR_ITEMS_KEY) return;
    publish(reconcile(loadSidebarItems()));
  });
}

/**
 * The sidebar's item layout — which entries show, and in what order. Every
 * consumer reads the same snapshot, so changes made in Settings → Sidebar
 * Items reach the live sidebar in the same render.
 */
export const useSidebarItems = () => {
  const layout = useSyncExternalStore(subscribe, getSnapshot);

  // Mutators read the live snapshot rather than the one captured in this
  // render, so a stale caller (framer's Reorder can hold an earlier
  // onReorder) can't resurrect an old order or visibility set.
  const setOrder = useCallback((nextOrder) => {
    write({ order: nextOrder, hidden: snapshot.hidden });
  }, []);

  // Shift one item up (-1) or down (+1). A no-op at either end.
  const moveItem = useCallback((id, delta) => {
    const { order, hidden } = snapshot;
    const from = order.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    write({ order: next, hidden });
  }, []);

  const toggleItem = useCallback((id) => {
    if (isNavItemLocked(id)) return;
    const { order, hidden } = snapshot;
    write({
      order,
      hidden: hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id],
    });
  }, []);

  const resetLayout = useCallback(() => {
    write({ order: [...DEFAULT_NAV_ORDER], hidden: [] });
  }, []);

  const { orderedItems, visibleItems, hiddenSet } = useMemo(() => {
    const ordered = layout.order.map(id => NAV_ITEMS_BY_ID.get(id));
    const hidden = new Set(layout.hidden);
    return {
      orderedItems: ordered,
      visibleItems: ordered.filter(item => !hidden.has(item.id)),
      hiddenSet: hidden,
    };
  }, [layout]);

  return {
    // Every nav item, in the user's order — for the Settings editor.
    orderedItems,
    // Just the ones to render in the sidebar.
    visibleItems,
    order: layout.order,
    isHidden: (id) => hiddenSet.has(id),
    hiddenCount: layout.hidden.length,
    totalCount: NAV_ITEMS.length,
    isCustomized: !isDefaultLayout(layout),
    setOrder,
    moveItem,
    toggleItem,
    resetLayout,
  };
};

export default useSidebarItems;
