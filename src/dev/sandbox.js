// A throwaway copy of the app's storage, for the Screenshot Studio.
//
// The studio's whole premise is that it renders the REAL views — the same
// DailyTracker, the same Reports — so what you photograph is what ships. That
// only works if those components can read and write storage exactly as they
// normally do. So instead of teaching every component about fixtures, we swap
// what "storage" means for as long as the studio is open:
//
//   - Kronos' localStorage keys answer from an overlay: seeded keys come back
//     as the scenario wrote them, the rest report missing (so the app falls
//     back to its own defaults), and writes land in the overlay and are
//     dropped on exit.
//   - The two IndexedDB-backed caches (entries, weekly rows) are detached from
//     IDB by storage.js, so they hold fixtures without flushing them.
//   - Cloud pushes are paused, so fixtures can't reach the user's account.
//
// Only keys Kronos owns are intercepted. Everything else — most importantly
// the Supabase session token, which is read and rewritten on its own schedule
// — passes straight through to real storage, because a signed-in user should
// not get signed out for opening a screenshot tool.
//
// All of it is undone by exitSandbox(), which gives back the prototype methods
// it borrowed and tells every subscriber to re-read the real data — so closing
// the studio leaves the app exactly where it was.

import {
  enterStorageSandbox,
  exitStorageSandbox,
  isStorageSandboxed,
  getActiveWorkspaceId,
} from '../utils/storage';
import { setPushPaused } from '../utils/syncEngine';

// Every key the app writes is one of these two shapes: `kronos_…` for data and
// preferences (workspace-suffixed or not), `__kronos_…` for the corruption
// quarantine. Both are ours to fake; nothing else is.
const isOurs = (key) => key.startsWith('kronos_') || key.startsWith('__kronos_');

// Sandboxed keys only. A key that isn't here reads as missing, which is what
// makes each scenario start from the app's own defaults.
const overlay = new Map();

let patched = null; // the Storage.prototype members we replaced

const isLocal = (store) => store === window.localStorage;

// Real (unpatched) enumeration, so we can report a world that is part real —
// other people's keys — and part sandbox.
const realLength = () => patched.length.get.call(window.localStorage);
const realKeyAt = (i) => patched.key.call(window.localStorage, i);

const effectiveKeys = () => {
  const keys = [];
  const len = realLength();
  for (let i = 0; i < len; i++) {
    const k = realKeyAt(i);
    if (k != null && !isOurs(k)) keys.push(k); // untouched, still visible
  }
  for (const [k, v] of overlay) {
    if (v !== null) keys.push(k);              // ours, as the scenario left it
  }
  return keys;
};

export const isSandboxed = () => patched !== null;

export const enterSandbox = () => {
  if (patched) return;

  // Prime storage.js's active-workspace cache off the real value first: it is
  // memoized on first read, and a first read taken through the overlay would
  // pin every key to the default workspace for the rest of the session.
  getActiveWorkspaceId();

  const proto = Storage.prototype;
  patched = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
    key: proto.key,
    length: Object.getOwnPropertyDescriptor(proto, 'length'),
  };

  // Patched on the prototype rather than the instance: assigning to
  // `localStorage.getItem` is a named-property write in some browsers (it
  // would store an item called "getItem"), which is not what we want at all.
  // sessionStorage shares this prototype, hence the `isLocal` guard.
  proto.getItem = function (key) {
    const k = String(key);
    if (isLocal(this) && isOurs(k)) {
      return overlay.has(k) ? overlay.get(k) : null;
    }
    return patched.getItem.call(this, key);
  };

  proto.setItem = function (key, value) {
    const k = String(key);
    if (isLocal(this) && isOurs(k)) {
      overlay.set(k, String(value));
      return undefined;
    }
    return patched.setItem.call(this, key, value);
  };

  proto.removeItem = function (key) {
    const k = String(key);
    if (isLocal(this) && isOurs(k)) {
      overlay.set(k, null);
      return undefined;
    }
    return patched.removeItem.call(this, key);
  };

  // Nothing in the app calls this, but "Reset Everything" is one of the
  // scenarios and a stray clear() must not be the one thing that gets through.
  proto.clear = function () {
    if (isLocal(this)) {
      resetSandbox();
      return undefined;
    }
    return patched.clear.call(this);
  };

  proto.key = function (index) {
    if (isLocal(this)) return effectiveKeys()[index] ?? null;
    return patched.key.call(this, index);
  };

  Object.defineProperty(proto, 'length', {
    configurable: true,
    enumerable: patched.length?.enumerable ?? false,
    get() {
      if (isLocal(this)) return effectiveKeys().length;
      return patched.length.get.call(this);
    },
  });

  resetSandbox();
  if (!isStorageSandboxed()) enterStorageSandbox();
  setPushPaused(true);
};

/**
 * Blank slate between scenarios: every key of ours reads as missing, so the
 * app falls back to its own defaults and one scenario's fixtures can't bleed
 * into the next. The scenario then seeds what it wants through the ordinary
 * save functions in utils/storage.js, which is why it never has to know how a
 * key is named or which workspace it belongs to.
 */
export const resetSandbox = () => {
  overlay.clear();
};

export const exitSandbox = () => {
  if (!patched) return;

  const proto = Storage.prototype;
  proto.getItem = patched.getItem;
  proto.setItem = patched.setItem;
  proto.removeItem = patched.removeItem;
  proto.clear = patched.clear;
  proto.key = patched.key;
  if (patched.length) Object.defineProperty(proto, 'length', patched.length);
  else delete proto.length;

  overlay.clear();
  patched = null;

  exitStorageSandbox();
  setPushPaused(false);
};
