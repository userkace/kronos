// The chime that plays when you hit your daily hours goal.
//
// Two kinds of sound live here:
//
//   1. BUILT-INS, synthesized on the fly with WebAudio. No asset files ship
//      with the app and nothing is fetched at runtime — each preset is a short
//      recipe of sine/triangle partials with an exponential decay envelope,
//      which keeps the bundle unchanged and makes the sounds tweakable in one
//      table below.
//   2. A CUSTOM UPLOAD, held in IndexedDB (not localStorage — an audio file
//      blows the ~5MB string quota, and IDB stores the Blob itself). It's the
//      same `kronosDB` keyval store the timesheet uses, so there's no second
//      database to open.
//
// Both paths go through playGoalAlert(), which resolves "which sound" from the
// saved preference and never throws: a chime that fails is a non-event, and
// the goal toast still lands.

import { idbGet, idbSet, idbDelete } from './timesheetDB';

// Not workspace-scoped: the sound you want to hear is a property of the device
// you're sitting at, like the theme, not of the client you're billing.
const CUSTOM_SOUND_IDB_KEY = 'kronos_goal_alert_custom_sound';

// Anything larger is almost certainly a music track rather than a chime, and
// holding it in IDB (plus decoding it on every play) isn't worth it.
export const MAX_CUSTOM_SOUND_BYTES = 2 * 1024 * 1024;

// Each preset is a list of partials: { freq, delay, duration, gain, type }.
// `delay` is seconds after the trigger, so a two-note chime is just two
// partials with different delays. Kept deliberately short — this fires while
// someone is working, and a long sound is a worse interruption than a brief one.
export const BUILT_IN_SOUNDS = [
  {
    id: 'chime',
    label: 'Chime',
    description: 'Two soft bell tones',
    partials: [
      { freq: 880.0, delay: 0.00, duration: 0.9, gain: 0.5, type: 'sine' },
      { freq: 1318.5, delay: 0.00, duration: 0.9, gain: 0.22, type: 'sine' },
      { freq: 1174.7, delay: 0.18, duration: 1.1, gain: 0.45, type: 'sine' },
      { freq: 1760.0, delay: 0.18, duration: 1.1, gain: 0.18, type: 'sine' },
    ],
  },
  {
    id: 'ping',
    label: 'Ping',
    description: 'A single bright note',
    partials: [
      { freq: 1567.98, delay: 0, duration: 0.55, gain: 0.5, type: 'sine' },
      { freq: 3135.96, delay: 0, duration: 0.35, gain: 0.12, type: 'sine' },
    ],
  },
  {
    id: 'marimba',
    label: 'Marimba',
    description: 'Warm wooden triad',
    partials: [
      { freq: 523.25, delay: 0.00, duration: 0.5, gain: 0.5, type: 'triangle' },
      { freq: 659.25, delay: 0.09, duration: 0.5, gain: 0.45, type: 'triangle' },
      { freq: 783.99, delay: 0.18, duration: 0.8, gain: 0.42, type: 'triangle' },
    ],
  },
  {
    id: 'arcade',
    label: 'Arcade',
    description: 'Rising game-style fanfare',
    partials: [
      { freq: 523.25, delay: 0.00, duration: 0.14, gain: 0.35, type: 'square' },
      { freq: 659.25, delay: 0.10, duration: 0.14, gain: 0.35, type: 'square' },
      { freq: 783.99, delay: 0.20, duration: 0.14, gain: 0.35, type: 'square' },
      { freq: 1046.5, delay: 0.30, duration: 0.45, gain: 0.40, type: 'square' },
    ],
  },
  {
    id: 'gong',
    label: 'Gong',
    description: 'Low, slow decay',
    partials: [
      { freq: 146.83, delay: 0, duration: 2.4, gain: 0.55, type: 'sine' },
      { freq: 220.00, delay: 0, duration: 2.0, gain: 0.30, type: 'sine' },
      { freq: 329.63, delay: 0, duration: 1.6, gain: 0.16, type: 'triangle' },
      { freq: 493.88, delay: 0, duration: 1.2, gain: 0.08, type: 'triangle' },
    ],
  },
];

export const CUSTOM_SOUND_ID = 'custom';
export const DEFAULT_SOUND_ID = 'chime';

export const isBuiltInSoundId = (id) => BUILT_IN_SOUNDS.some(s => s.id === id);

export const soundLabel = (id, customName) => {
  if (id === CUSTOM_SOUND_ID) return customName || 'Custom sound';
  return BUILT_IN_SOUNDS.find(s => s.id === id)?.label ?? 'Chime';
};

// ── WebAudio ──────────────────────────────────────────────────────────────

// One shared context for the life of the tab. Browsers cap how many can exist,
// and creating one per play leaks them.
let _ctx = null;

const getContext = () => {
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  _ctx = new Ctor();
  return _ctx;
};

// Autoplay policy suspends a context created before any user gesture. Every
// play path resumes first; by the time a goal is reached the user has clicked
// Start at minimum, so this normally succeeds.
const resumeContext = async (ctx) => {
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* stays suspended; play is a no-op */ }
  }
  return ctx.state === 'running';
};

const playPreset = async (preset, volume) => {
  const ctx = getContext();
  if (!ctx || !preset) return false;
  if (!(await resumeContext(ctx))) return false;

  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  master.connect(ctx.destination);

  const now = ctx.currentTime;
  preset.partials.forEach(({ freq, delay, duration, gain, type }) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;

    // Percussive envelope: a 12ms ramp in (long enough to avoid a click, short
    // enough to still read as a strike) then an exponential tail to silence.
    // exponentialRamp can't touch zero, hence the 0.0001 floor at both ends.
    const start = now + delay;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  });

  return true;
};

// ── Custom sound ──────────────────────────────────────────────────────────

// Decoded PCM for the uploaded file, cached so repeat plays don't re-decode a
// couple of megabytes. Reset whenever the stored file changes.
let _customBufferCache = null;

/** The uploaded sound, or null. Shape: { name, type, size, blob }. */
export const loadCustomSound = async () => {
  try {
    const stored = await idbGet(CUSTOM_SOUND_IDB_KEY);
    if (!stored || !stored.blob) return null;
    return stored;
  } catch (error) {
    console.error('Error loading custom goal alert sound:', error);
    return null;
  }
};

/**
 * Store an uploaded File as the custom sound. Throws with a user-facing
 * message when the file is too large or isn't decodable audio — better to
 * refuse at upload time than to have the goal chime silently do nothing hours
 * later, when there's no obvious connection back to this screen.
 */
export const saveCustomSound = async (file) => {
  if (!file) throw new Error('No file selected');
  if (file.size > MAX_CUSTOM_SOUND_BYTES) {
    throw new Error(
      `Sound file must be under ${Math.round(MAX_CUSTOM_SOUND_BYTES / (1024 * 1024))}MB`
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  const ctx = getContext();
  if (ctx) {
    try {
      // decodeAudioData detaches the buffer it is given, so hand it a copy —
      // otherwise the Blob built below would be made from an empty one.
      _customBufferCache = await ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      _customBufferCache = null;
      throw new Error('That file could not be read as audio. Try MP3, WAV, OGG, or M4A.');
    }
  }

  const record = {
    name: file.name,
    type: file.type || 'audio/mpeg',
    size: file.size,
    blob: new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' }),
  };

  await idbSet(CUSTOM_SOUND_IDB_KEY, record);
  return record;
};

export const deleteCustomSound = async () => {
  _customBufferCache = null;
  await idbDelete(CUSTOM_SOUND_IDB_KEY);
};

const playCustom = async (volume) => {
  const ctx = getContext();
  if (!ctx) return false;
  if (!(await resumeContext(ctx))) return false;

  if (!_customBufferCache) {
    const stored = await loadCustomSound();
    if (!stored) return false;
    try {
      _customBufferCache = await ctx.decodeAudioData(await stored.blob.arrayBuffer());
    } catch (error) {
      console.error('Error decoding custom goal alert sound:', error);
      return false;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = _customBufferCache;
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return true;
};

/**
 * Play the goal chime. `soundId` is a built-in id or CUSTOM_SOUND_ID; a custom
 * selection with nothing uploaded falls back to the default built-in so the
 * alert is never silent by accident.
 *
 * @returns {Promise<boolean>} whether a sound actually started.
 */
export const playGoalAlert = async ({ soundId = DEFAULT_SOUND_ID, volume = 0.7 } = {}) => {
  try {
    if (soundId === CUSTOM_SOUND_ID) {
      if (await playCustom(volume)) return true;
    }
    const preset =
      BUILT_IN_SOUNDS.find(s => s.id === soundId) ||
      BUILT_IN_SOUNDS.find(s => s.id === DEFAULT_SOUND_ID);
    return await playPreset(preset, volume);
  } catch (error) {
    console.error('Error playing goal alert sound:', error);
    return false;
  }
};

/**
 * Called from a click handler to unlock audio ahead of time. The goal is
 * usually reached mid-work with no click in flight, and some browsers refuse
 * to resume a context outside a gesture — priming it on any earlier
 * interaction (saving settings, previewing a sound) means the real alert can
 * play when its moment comes.
 */
export const primeAudio = () => {
  const ctx = getContext();
  if (ctx) resumeContext(ctx);
};
