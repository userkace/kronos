import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

// How long the splash holds before asking the parent to dismiss it. The exit
// fade itself is handled by AnimatePresence in the parent.
const SPLASH_DURATION_MS = 1900;
const REDUCED_DURATION_MS = 900;

const SplashScreen = ({ onFinish }) => {
  const { getTransition, shouldReduceMotion } = useMotionPreferences();

  // Keep the latest callback in a ref so the dismiss timer is armed exactly
  // once on mount — a parent re-render passing a new inline onFinish must not
  // restart the countdown.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useEffect(() => {
    const duration = shouldReduceMotion ? REDUCED_DURATION_MS : SPLASH_DURATION_MS;
    const timer = setTimeout(() => onFinishRef.current(), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeUp = (delay) => ({
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: getTransition({ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }),
  });

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-slate-50"
      role="status"
      aria-label="Loading Kronos"
    >
      {/* Same ambient backdrop as onboarding: faint dot grid + soft washes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(15_23_42/0.05)_1px,transparent_0)] bg-size-[26px_26px]" />
        <div className="absolute -top-40 -left-32 h-120 w-120 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-136 w-136 rounded-full bg-indigo-200/40 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center">
        <motion.img
          src="/kronos-round.png"
          alt=""
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={getTransition({ duration: 0.55, ease: [0.22, 1, 0.36, 1] })}
          className="h-20 w-20 drop-shadow-md"
        />
        <motion.span
          {...fadeUp(0.18)}
          className="mt-5 font-display text-2xl font-semibold lowercase tracking-wide text-gray-900"
        >
          kronos
        </motion.span>
        <motion.span {...fadeUp(0.32)} className="mt-1.5 text-sm text-gray-500">
          Own your time.
        </motion.span>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
