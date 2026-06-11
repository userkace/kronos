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
} from 'lucide-react';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TOTAL_STEPS = 3;

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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      {/* Ambient backdrop: faint dot grid + soft color washes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(15_23_42/0.05)_1px,transparent_0)] bg-size-[26px_26px]" />
        <div className="absolute -top-40 -left-32 h-120 w-120 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-136 w-136 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16, scale: shouldReduceMotion ? 1 : 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={getTransition({ duration: 0.45, ease: [0.22, 1, 0.36, 1] })}
        className="relative w-full max-w-xl"
      >
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white/95 shadow-xl backdrop-blur-sm"
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

          {/* Header: wordmark + step counter */}
          <div className="flex items-center justify-between px-6 pt-6 sm:px-10">
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

          {/* Step content */}
          <div className="px-6 pb-6 pt-8 sm:px-10 sm:pb-8">
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

                  <button
                    type="button"
                    onClick={nextStep}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
                  >
                    <span>Get started</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
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
            </AnimatePresence>

            {/* Footer nav (steps 2 & 3 — the welcome step has its own CTA) */}
            {currentStep > 0 && (
              <div className="mt-8 flex items-center gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 shadow-xs transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900"
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
                    className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    key="finish"
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors duration-150 hover:bg-blue-500 active:bg-blue-700"
                  >
                    <Check className="h-4 w-4" />
                    <span>Finish setup</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          Your data never leaves this device.
        </p>
      </motion.div>
    </div>
  );
};

export default Onboarding;
