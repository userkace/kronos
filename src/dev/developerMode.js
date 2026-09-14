// Developer mode: the switch that reveals Settings → Developer, and with it
// the Screenshot Studio.
//
// It is unlocked the way Android does it — by tapping the version line in
// Settings → About ten times, with a countdown once you're halfway there. The
// point isn't secrecy: it's that tools nobody asked for stay out of everyone's
// way, while anyone who wants them can reach them on any install, and the
// gesture is memorable enough to repeat on another machine.
//
// The state is device-local and deliberately NOT workspace-scoped: it's a
// property of the machine you're developing on, not of anyone's data.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kronos_developer_mode';

/** Taps needed in total, and the tap from which the countdown starts. */
export const TAPS_TO_UNLOCK = 10;
export const COUNTDOWN_FROM = 5;

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

// Cached in the module rather than re-read per render: the Screenshot Studio
// sandboxes localStorage while it's open, so a read taken mid-session would
// report "off" and flicker the Developer group out from under the real page.
let enabled = read();
const listeners = new Set();

const emit = () => listeners.forEach(fn => fn());

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const isDeveloperModeEnabled = () => enabled;

export const setDeveloperMode = (next) => {
  const value = Boolean(next);
  if (value === enabled) return;
  enabled = value;
  try {
    if (value) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — the switch still holds for this session.
  }
  emit();
};

/** Subscribe a component to the switch. */
export const useDeveloperMode = () =>
  useSyncExternalStore(subscribe, isDeveloperModeEnabled, () => false);

/**
 * Register one tap on the version line and say what should happen.
 *
 * Returns one of:
 *   { kind: 'quiet' }                    — keep counting, say nothing
 *   { kind: 'countdown', remaining: n }  — n more taps to go
 *   { kind: 'unlocked' }                 — developer mode just came on
 *   { kind: 'already' }                  — it was already on
 *
 * `count` is held by the caller (Settings) so the tally resets naturally when
 * you navigate away, which is exactly when you'd want it to.
 */
export const describeTap = (count) => {
  if (enabled) return { kind: 'already' };
  if (count >= TAPS_TO_UNLOCK) return { kind: 'unlocked' };
  const remaining = TAPS_TO_UNLOCK - count;
  if (remaining > COUNTDOWN_FROM) return { kind: 'quiet' };
  return { kind: 'countdown', remaining };
};
