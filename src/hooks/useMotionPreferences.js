import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Custom hook that combines framer-motion's useReducedMotion with additional performance checks
 * to determine whether animations should be disabled or simplified for accessibility and performance.
 *
 * @returns {Object} - Object containing motion preferences and animation settings
 */
export const useMotionPreferences = () => {
  const prefersReducedMotion = useReducedMotion();
  const [performanceSettings, setPerformanceSettings] = useState({
    disableComplexAnimations: false,
    reducedDuration: false,
    disableTransitions: false
  });

  useEffect(() => {
    const checkPerformanceCapabilities = () => {
      // If user already prefers reduced motion, respect that first
      if (prefersReducedMotion) {
        setPerformanceSettings({
          disableComplexAnimations: true,
          reducedDuration: true,
          disableTransitions: false // Keep basic transitions for usability
        });
        return;
      }

      // Check for performance constraints that might require reduced animations
      const navigator = window.navigator;
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      let disableComplex = false;
      let reducedDuration = false;

      // Check for slow network connections
      if (connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
        disableComplex = true;
        reducedDuration = true;
      }

      // Check for low-end devices (less than 4 CPU cores)
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        disableComplex = true;
        reducedDuration = true;
      }

      // Check for low memory devices (if available)
      if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        disableComplex = true;
      }

      setPerformanceSettings({
        disableComplexAnimations: disableComplex,
        reducedDuration: reducedDuration,
        disableTransitions: false // Never disable transitions completely as it affects usability
      });
    };

    checkPerformanceCapabilities();

    // Listen for changes in network connection
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const handleConnectionChange = () => {
        checkPerformanceCapabilities();
      };

      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, [prefersReducedMotion]);

  // Helper function to get appropriate animation duration
  const getDuration = (normalDuration, reducedDuration = 0.1) => {
    return performanceSettings.reducedDuration ? reducedDuration : normalDuration;
  };

  // Helper function to get appropriate animation variants
  const getVariants = (variants) => {
    if (performanceSettings.disableComplexAnimations) {
      // Return simplified variants that remove complex transforms and filters
      return Object.keys(variants).reduce((acc, key) => {
        acc[key] = {
          opacity: variants[key].opacity !== undefined ? variants[key].opacity : 1,
          ...(variants[key].x !== undefined && { x: variants[key].x }),
          ...(variants[key].y !== undefined && { y: variants[key].y }),
          // Remove scale, rotate, filter, and other complex transforms
        };
        return acc;
      }, {});
    }
    return variants;
  };

  // Helper function to get transition settings
  const getTransition = (baseTransition) => {
    if (performanceSettings.disableComplexAnimations) {
      return {
        duration: getDuration(baseTransition.duration || 0.3, 0.1),
        ease: 'easeOut'
      };
    }

    if (performanceSettings.reducedDuration) {
      return {
        ...baseTransition,
        duration: getDuration(baseTransition.duration || 0.3, 0.15)
      };
    }

    return baseTransition;
  };

  return {
    // Boolean flags
    shouldReduceMotion: prefersReducedMotion || performanceSettings.disableComplexAnimations,
    prefersReducedMotion,
    disableComplexAnimations: performanceSettings.disableComplexAnimations,
    reducedDuration: performanceSettings.reducedDuration,

    // Helper functions
    getDuration,
    getVariants,
    getTransition,

    // Preset animation configurations
    animations: {
      // Fade animations (always safe to use)
      fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: getDuration(0.2, 0.1) }
      },

      // Slide animations (simplified when reduced motion is preferred)
      slide: {
        initial: { opacity: 0, x: performanceSettings.disableComplexAnimations ? 0 : 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: performanceSettings.disableComplexAnimations ? 0 : -20 },
        transition: { duration: getDuration(0.3, 0.15) }
      },

      // Scale animations (disabled when reduced motion is preferred)
      scale: {
        initial: { opacity: 0, scale: performanceSettings.disableComplexAnimations ? 1 : 0.8 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: performanceSettings.disableComplexAnimations ? 1 : 0.8 },
        transition: { duration: getDuration(0.2, 0.1) }
      },

      // Spring animations (converted to ease animations when reduced motion is preferred)
      spring: {
        initial: { opacity: 0, y: performanceSettings.disableComplexAnimations ? 0 : 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: performanceSettings.disableComplexAnimations ? 0 : -10 },
        transition: {
          type: performanceSettings.disableComplexAnimations ? 'tween' : 'spring',
          duration: getDuration(0.4, 0.2),
          ease: performanceSettings.disableComplexAnimations ? 'easeOut' : undefined
        }
      }
    }
  };
};
