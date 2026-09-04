import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Play, Upload, Trash2, Volume2, VolumeX, FlaskConical } from 'lucide-react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import {
  BUILT_IN_SOUNDS,
  CUSTOM_SOUND_ID,
  DEFAULT_SOUND_ID,
  MAX_CUSTOM_SOUND_BYTES,
  loadCustomSound,
  saveCustomSound,
  deleteCustomSound,
  playGoalAlert,
  primeAudio,
} from '../utils/goalAlertSound';

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const REPEAT_OPTIONS = [
  { value: 0, label: 'Don’t repeat' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
];

/**
 * One selectable sound. Declared at module scope on purpose: as a function
 * defined inside GoalAlertSettings it would be a brand-new component type on
 * every render, so picking a sound would remount every tile and throw away the
 * keyboard focus of the one just chosen.
 */
const SoundTile = ({ id, label, description, disabled, isSelected, isPreviewing, onSelect }) => (
  <button
    type="button"
    onClick={() => !disabled && onSelect(id)}
    disabled={disabled}
    aria-pressed={isSelected}
    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
      disabled
        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
        : isSelected
          ? 'border-blue-600 bg-blue-50 shadow-xs'
          : 'border-gray-200 bg-white shadow-xs hover:border-gray-300'
    }`}
  >
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
      }`}
    >
      <Play className={`h-3.5 w-3.5 fill-current ${isPreviewing ? 'animate-pulse' : ''}`} />
    </span>
    <span className="min-w-0">
      <span className={`block truncate text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
        {label}
      </span>
      <span className="block truncate text-[12px] text-gray-500">{description}</span>
    </span>
  </button>
);

/**
 * Settings → General → Goal Alert.
 *
 * Every control here applies the moment you touch it, like the theme picker
 * and unlike the fields batched behind Save Changes. A sound you can't hear
 * until you save is a sound you can't choose, and the same is true of the
 * volume — you pick these by ear, so the preview has to be playing whatever is
 * currently selected.
 *
 * `onPreviewGoalAlert` is supplied only on the dev host (see App.jsx); it runs
 * the real crossing routine rather than a stand-in, so the alert can be judged
 * exactly as a user meeting their goal would get it.
 */
const GoalAlertSettings = ({ onPreviewGoalAlert }) => {
  const { goalAlert, changeGoalAlert } = useUserPreferences();
  const { success, error, warning } = useToast();
  const { getTransition } = useMotionPreferences();

  const [customSound, setCustomSound] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  // Which tile is mid-preview, purely so the icon can show it's doing something.
  const [previewingId, setPreviewingId] = useState(null);
  const fileInputRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadCustomSound().then(stored => {
      if (!cancelled) setCustomSound(stored);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
  }, []);

  const preview = (soundId) => {
    // Any click here is a user gesture, which is the only moment the browser
    // reliably lets us wake the audio context for later, unprompted plays.
    primeAudio();
    setPreviewingId(soundId);
    playGoalAlert({ soundId, volume: goalAlert.volume });
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = setTimeout(() => setPreviewingId(null), 900);
  };

  const selectSound = (soundId) => {
    changeGoalAlert({ soundId });
    preview(soundId);
  };

  const handleToggle = () => {
    const next = !goalAlert.enabled;
    changeGoalAlert({ enabled: next });
    if (next) preview(goalAlert.soundId);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    // Clear the input straight away so re-picking the same file still fires
    // onChange — otherwise a failed upload can't be retried with the same file.
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      const record = await saveCustomSound(file);
      setCustomSound(record);
      changeGoalAlert({ soundId: CUSTOM_SOUND_ID });
      success(`"${record.name}" is now your goal alert sound`);
      preview(CUSTOM_SOUND_ID);
    } catch (err) {
      error(err.message || 'Could not use that sound file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveCustom = async () => {
    try {
      await deleteCustomSound();
      setCustomSound(null);
      if (goalAlert.soundId === CUSTOM_SOUND_ID) {
        changeGoalAlert({ soundId: DEFAULT_SOUND_ID });
      }
      warning('Custom sound removed');
    } catch {
      error('Could not remove the custom sound');
    }
  };

  const selectedId = goalAlert.soundId;
  const volumePercent = Math.round(goalAlert.volume * 100);

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <BellRing className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-gray-900 tracking-tight">Goal Alert</h4>
          <p className="text-[13px] text-gray-500">A sound when you hit your daily hours goal.</p>
        </div>
      </div>

      {/* Master switch */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Ping me when I reach my goal</p>
          <p className="text-[13px] text-gray-500">
            Plays once a day, wherever you are in the app.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={goalAlert.enabled}
          aria-label="Ping me when I reach my daily goal"
          onClick={handleToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${
            goalAlert.enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-all duration-150 ${
              goalAlert.enabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {goalAlert.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={getTransition({ duration: 0.3, ease: 'easeOut' })}
            className="overflow-hidden"
          >
            <div className="space-y-5 pt-5">
              {/* Sound picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sound</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BUILT_IN_SOUNDS.map(sound => (
                    <SoundTile
                      key={sound.id}
                      id={sound.id}
                      label={sound.label}
                      description={sound.description}
                      isSelected={selectedId === sound.id}
                      isPreviewing={previewingId === sound.id}
                      onSelect={selectSound}
                    />
                  ))}
                  <SoundTile
                    id={CUSTOM_SOUND_ID}
                    label={customSound ? customSound.name : 'Your own sound'}
                    description={
                      customSound
                        ? formatBytes(customSound.size)
                        : 'Upload a file to use it'
                    }
                    disabled={!customSound}
                    isSelected={selectedId === CUSTOM_SOUND_ID}
                    isPreviewing={previewingId === CUSTOM_SOUND_ID}
                    onSelect={selectSound}
                  />
                </div>
                <p className="mt-2 text-[13px] text-gray-500">
                  Click a sound to hear it and select it.
                </p>
              </div>

              {/* Custom upload */}
              <div className="border-t border-gray-100 pt-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom sound
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors duration-150 hover:border-gray-300 hover:text-gray-900 disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading
                      ? 'Reading file…'
                      : customSound ? 'Replace file' : 'Upload a sound file'}
                  </button>
                  {customSound && (
                    <button
                      type="button"
                      onClick={handleRemoveCustom}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-xs transition-colors duration-150 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-gray-500">
                  MP3, WAV, OGG, or M4A up to {Math.round(MAX_CUSTOM_SOUND_BYTES / (1024 * 1024))}MB.
                  Stored on this device only — it isn&apos;t synced or included in exports.
                </p>
              </div>

              {/* Volume */}
              <div className="border-t border-gray-100 pt-5">
                <label htmlFor="goalAlertVolume" className="block text-sm font-medium text-gray-700 mb-2">
                  Volume
                </label>
                <div className="flex items-center gap-3">
                  {volumePercent === 0
                    ? <VolumeX className="h-4 w-4 shrink-0 text-gray-400" />
                    : <Volume2 className="h-4 w-4 shrink-0 text-gray-400" />}
                  <input
                    id="goalAlertVolume"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={volumePercent}
                    onChange={(e) => changeGoalAlert({ volume: Number(e.target.value) / 100 })}
                    // Previewing on release rather than on every step keeps a
                    // drag from stacking a dozen overlapping chimes.
                    onMouseUp={() => preview(selectedId)}
                    onTouchEnd={() => preview(selectedId)}
                    onKeyUp={() => preview(selectedId)}
                    className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600"
                  />
                  <span className="w-10 shrink-0 text-sm tabular-nums text-gray-500">
                    {volumePercent}%
                  </span>
                </div>
                {volumePercent === 0 && (
                  <p className="mt-2 text-[13px] text-amber-600">
                    Silent — you&apos;ll still get the on-screen message.
                  </p>
                )}
              </div>

              {/* Repeat */}
              <div className="border-t border-gray-100 pt-5">
                <label htmlFor="goalAlertRepeat" className="block text-sm font-medium text-gray-700 mb-2">
                  If I keep working
                </label>
                <select
                  id="goalAlertRepeat"
                  value={goalAlert.repeatMinutes}
                  onChange={(e) => changeGoalAlert({ repeatMinutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                >
                  {REPEAT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[13px] text-gray-500">
                  Nudge again while the timer is still running past your goal.
                </p>
              </div>

              {/* Dev-host only: run the genuine article */}
              {onPreviewGoalAlert && (
                <div className="border-t border-gray-100 pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      primeAudio();
                      onPreviewGoalAlert({ persist: false });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs transition-colors duration-150 hover:border-gray-300 hover:text-gray-900"
                  >
                    <FlaskConical className="h-4 w-4" />
                    Simulate reaching the goal
                  </button>
                  <p className="mt-2 text-[13px] text-gray-500">
                    Dev host only. Runs the real alert — sound and message, exactly as it
                    fires on the day — without marking today as already alerted.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoalAlertSettings;
