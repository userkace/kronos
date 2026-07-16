import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TimezoneSelect from './TimezoneSelect';
import {
  Globe,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  CalendarRange,
  FileDown,
  Cloud,
  Mail,
  Loader2,
} from 'lucide-react';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import { useAuth } from '../contexts/AuthContext';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FEATURES = [
  {
    icon: Globe,
    tint: 'bg-blue-50 text-blue-600',
    title: 'Timezone aware',
    description: 'Hours are logged in your zone — or your company’s.',
  },
  {
    icon: CalendarRange,
    tint: 'bg-indigo-50 text-indigo-600',
    title: 'Weekly timesheets',
    description: 'Your week, summarized and ready to send.',
  },
  {
    icon: FileDown,
    tint: 'bg-emerald-50 text-emerald-600',
    title: 'Yours to keep',
    description: 'Everything lives on your device. Export anytime.',
  },
];

const Onboarding = ({ onComplete, initialTimezone = 'UTC' }) => {
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [weekStart, setWeekStart] = useState('sunday');
  const [weekendDays, setWeekendDays] = useState([0, 6]);
  const [currentStep, setCurrentStep] = useState(0);
  // +1 when moving forward, -1 backward — drives the slide direction
  const [direction, setDirection] = useState(1);
  const { getTransition, shouldReduceMotion } = useMotionPreferences();

  // Optional cloud sign-in step — only when Supabase is configured. Signing in
  // here is non-blocking: the magic link finishes the sign-in later (on click),
  // so onboarding always completes locally regardless.
  const { isConfigured, user, signInWithMagicLink } = useAuth();
  const TOTAL_STEPS = isConfigured ? 4 : 3;
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);

  const handleSendLink = async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    setSendError(null);
    const { ok, error } = await signInWithMagicLink(email);
    setSending(false);
    if (ok) setSent(true);
    else setSendError(error || 'Could not send the link.');
  };

  const toggleWeekendDay = (idx) => {
    setWeekendDays(prev =>
      prev.includes(idx)
        ? prev.filter(d => d !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const nextStep = () => {
    setDirection(1);
    setCurrentStep(step => Math.min(step + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    setDirection(-1);
    setCurrentStep(step => Math.max(step - 1, 0));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Enter advances earlier steps instead of finishing the whole flow
    if (currentStep < TOTAL_STEPS - 1) {
      nextStep();
      return;
    }
    onComplete({
      timezone: selectedTimezone,
      weekStart: weekStart,
      weekendDays: weekendDays,
    });
  };

  const slideDistance = shouldReduceMotion ? 0 : 28;
  const stepVariants = {
    initial: (dir) => ({ opacity: 0, x: dir * slideDistance }),
    animate: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir * -slideDistance }),
  };
  const stepTransition = getTransition({ duration: 0.3, ease: [0.22, 1, 0.36, 1] });

  return (
    // Mobile-first, app-style layout: the flow fills the whole screen (white,
    // edge to edge) with the navigation pinned to the bottom like a native
    // onboarding. From `sm` up it becomes the centered card on a soft backdrop.
    // min-h-dvh tracks the real visible height under mobile browser toolbars.
    <div className="relative min-h-dvh bg-white sm:bg-slate-50 sm:flex sm:justify-center sm:p-6">
      {/* Ambient backdrop (desktop only): faint dot grid + soft color washes.
          Fixed + clipped so the oversized blobs never create horizontal scroll. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 hidden overflow-hidden sm:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(15_23_42/0.05)_1px,transparent_0)] bg-size-[26px_26px]" />
        <div className="absolute -top-40 -left-32 h-120 w-120 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-136 w-136 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16, scale: shouldReduceMotion ? 1 : 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={getTransition({ duration: 0.45, ease: [0.22, 1, 0.36, 1] })}
        className="relative flex min-h-dvh w-full max-w-xl flex-col mx-auto sm:my-auto sm:min-h-0"
      >
        {/* overflow-hidden is desktop-only: on mobile it would break the
            sticky bottom nav. */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col bg-white sm:flex-none sm:overflow-hidden sm:rounded-3xl sm:border sm:border-gray-200/80 sm:bg-white/95 sm:shadow-xl sm:backdrop-blur-sm"
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <motion.div
              className="h-full rounded-r-full bg-linear-to-r from-blue-500 to-indigo-500"
              initial={false}
              animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
              transition={getTransition({ type: 'spring', stiffness: 260, damping: 32 })}
            />
          </div>

          {/* Header: wordmark + step counter. Extra top padding on phones with
              a notch / status bar (PWA standalone). */}
          <div className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 sm:pt-6">
            <div className="flex items-center gap-2.5">
              <img
                src="/kronos-round.png"
                alt="Kronos"
                className="h-8 w-8 shrink-0"
              />
              <span className="font-display text-sm font-semibold lowercase tracking-wide text-gray-900">
                kronos
              </span>
            </div>
            <span className="text-xs font-medium tabular-nums text-gray-400">
              {currentStep + 1} / {TOTAL_STEPS}
            </span>
          </div>

          {/* Step content — grows to push the nav to the bottom on mobile. */}
          <div className="flex-1 px-5 pb-6 pt-7 sm:flex-none sm:px-10 sm:pb-0 sm:pt-8">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              {currentStep === 0 && (
                <motion.div
                  key="welcome"
                  custom={direction}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-8"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Welcome
                    </p>
                    <h1 className="font-display text-2xl font-semibold leading-snug text-gray-900 sm:text-[1.7rem]">
                      Time, tracked beautifully.
                    </h1>
                    <p className="max-w-md text-[15px] leading-relaxed text-gray-600">
                      Kronos keeps your hours, timesheets, and focus in one calm place.
                      Two quick questions and you&apos;re in.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {FEATURES.map(({ icon: Icon, tint, title, description }) => (
                      <div
                        key={title}
                        className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3.5"
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{title}</p>
                          <p className="text-sm text-gray-500">{description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="timezone"
                  custom={direction}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Timezone
                    </p>
                    <h1 className="font-display text-2xl font-semibold leading-snug text-gray-900 sm:text-[1.7rem]">
                      Where does your day happen?
                    </h1>
                    <p className="max-w-md text-[15px] leading-relaxed text-gray-600">
                      Pick a city on the map or use the dropdown — every entry is logged in this zone.
                    </p>
                  </div>

                  <TimezoneSelect
                    timezone={selectedTimezone}
                    onTimezoneChange={setSelectedTimezone}
                  />

                  <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-800">
                      <span className="font-semibold">Working remotely?</span>{' '}
                      Set this to your company&apos;s location so tracked hours align with their
                      business hours instead of your local time.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="week"
                  custom={direction}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Your week
                    </p>
                    <h1 className="font-display text-2xl font-semibold leading-snug text-gray-900 sm:text-[1.7rem]">
                      Shape your week.
                    </h1>
                    <p className="max-w-md text-[15px] leading-relaxed text-gray-600">
                      This sets how weekly timesheets are laid out. You can change it anytime in Settings.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-sm font-semibold text-gray-900">
                      Week starts on
                    </label>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                      {[
                        { value: 'sunday', label: 'Sunday' },
                        { value: 'monday', label: 'Monday' },
                      ].map(({ value, label }) => {
                        const isSelected = weekStart === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setWeekStart(value)}
                            aria-pressed={isSelected}
                            className={`relative rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${
                              isSelected
                                ? 'text-gray-900'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {isSelected && (
                              <motion.span
                                layoutId="weekstart-thumb"
                                className="absolute inset-0 rounded-lg bg-white shadow-xs ring-1 ring-gray-200/70"
                                transition={getTransition({ type: 'spring', stiffness: 400, damping: 32 })}
                              />
                            )}
                            <span className="relative">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-sm font-semibold text-gray-900">
                      Days you don&apos;t work
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_LABELS.map((label, idx) => {
                        const isSelected = weekendDays.includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleWeekendDay(idx)}
                            aria-pressed={isSelected}
                            className={`min-w-13 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                                : 'border-gray-200 bg-white text-gray-600 shadow-xs hover:border-gray-300 hover:text-gray-900'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-500">
                      Skipping these days won&apos;t break your tracking streak.
                    </p>
                  </div>
                </motion.div>
              )}

              {isConfigured && currentStep === 3 && (
                <motion.div
                  key="sync"
                  custom={direction}
                  variants={stepVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                      Sync · optional
                    </p>
                    <h1 className="font-display text-2xl font-semibold leading-snug text-gray-900 sm:text-[1.7rem]">
                      Back up &amp; sync across devices?
                    </h1>
                    <p className="max-w-md text-[15px] leading-relaxed text-gray-600">
                      Sign in with your email to back up your data and keep it in sync everywhere.
                      It&apos;s completely optional — Kronos works fully on this device without an account.
                    </p>
                  </div>

                  {user ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600">
                        <Check className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-900">You&apos;re signed in</p>
                        <p className="truncate text-[13px] text-emerald-700">{user.email}</p>
                      </div>
                    </div>
                  ) : sent ? (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <Mail className="h-4 w-4" /> Check your inbox
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-emerald-700">
                        We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on
                        this device any time to finish signing in — you can keep setting up now.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setSent(false); setEmail(''); }}
                        className="mt-2 text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                      >
                        Use a different email
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            inputMode="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendLink(); } }}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendLink}
                          disabled={sending || !email.trim()}
                          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50"
                        >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                          <span>Send link</span>
                        </button>
                      </div>
                      {sendError && (
                        <p className="text-xs text-red-600">{sendError}</p>
                      )}
                      <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                        <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <p className="text-xs leading-relaxed text-gray-500">
                          Passwordless — we&apos;ll email you a one-time link. You can also do this later from
                          <span className="font-medium text-gray-600"> Settings → Account &amp; Sync</span>.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* Bottom nav — pinned to the bottom of the screen on mobile, like a
              native app onboarding (sticky rides above scrolled content, with
              home-indicator safe-area padding). On desktop it's simply the
              card's footer. */}
          <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-10 sm:pb-8 sm:pt-8 sm:backdrop-blur-none">
            {currentStep === 0 ? (
              <button
                type="button"
                onClick={nextStep}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
              >
                <span>Get started</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-medium text-gray-600 shadow-xs transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
                {/* Distinct keys force a fresh DOM node: reusing one <button> and
                    flipping its type to "submit" mid-click makes the browser run
                    the click's default action against the new type and submit the
                    form, skipping this step. */}
                {currentStep < TOTAL_STEPS - 1 ? (
                  <button
                    key="continue"
                    type="button"
                    onClick={nextStep}
                    className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    key="finish"
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
                  >
                    <Check className="h-4 w-4" />
                    <span>Finish setup</span>
                  </button>
                )}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-gray-400 sm:hidden">
              {isConfigured
                ? 'Your data stays on this device — syncing is optional.'
                : 'Your data never leaves this device.'}
            </p>
          </div>
        </form>

        <p className="mt-5 hidden text-center text-xs text-gray-400 sm:block">
          {isConfigured
            ? 'Your data stays on this device — syncing is optional.'
            : 'Your data never leaves this device.'}
        </p>
      </motion.div>
    </div>
  );
};

export default Onboarding;
