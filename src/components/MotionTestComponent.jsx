import React from 'react';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

/**
 * Test component to verify motion preferences work correctly
 * This component displays the current motion settings and can be used
 * to test different scenarios including reduced motion preferences.
 */
const MotionTestComponent = () => {
  const {
    shouldReduceMotion,
    prefersReducedMotion,
    disableComplexAnimations,
    reducedDuration,
    getDuration,
    getVariants,
    getTransition,
    animations
  } = useMotionPreferences();

  return (
    <div className="p-6 bg-gray-50 rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Motion Preferences Test</h2>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Motion Settings</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Should Reduce Motion: <span className={`font-mono ${shouldReduceMotion ? 'text-red-600' : 'text-green-600'}`}>{shouldReduceMotion.toString()}</span></div>
            <div>Prefers Reduced Motion: <span className={`font-mono ${prefersReducedMotion ? 'text-red-600' : 'text-green-600'}`}>{prefersReducedMotion.toString()}</span></div>
            <div>Disable Complex Animations: <span className={`font-mono ${disableComplexAnimations ? 'text-orange-600' : 'text-green-600'}`}>{disableComplexAnimations.toString()}</span></div>
            <div>Reduced Duration: <span className={`font-mono ${reducedDuration ? 'text-orange-600' : 'text-green-600'}`}>{reducedDuration.toString()}</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Duration Test</h3>
          <div className="space-y-1 text-sm">
            <div>Normal duration (0.3s): <span className="font-mono">{getDuration(0.3)}s</span></div>
            <div>Reduced duration (0.1s): <span className="font-mono">{getDuration(0.3, 0.1)}s</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Animation Variants Test</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Scale Animation:</strong>
              <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
                {JSON.stringify(animations.scale, null, 2)}
              </pre>
            </div>
            <div>
              <strong>Slide Animation:</strong>
              <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
                {JSON.stringify(animations.slide, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-800">How to Test</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Open your browser's developer tools</li>
            <li>Go to the "Elements" panel and find the html tag</li>
            <li>Add <code className="bg-blue-100 px-1 rounded">style="prefers-reduced-motion: reduce"</code> to simulate reduced motion</li>
            <li>Or go to browser settings → Accessibility → Reduce motion</li>
            <li>Watch how the values above change</li>
          </ol>
        </div>

        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
          <h3 className="font-semibold mb-2 text-yellow-800">Performance Tests</h3>
          <p className="text-sm text-yellow-700">
            The system also automatically detects performance constraints and may reduce animations on:
          </p>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside mt-2">
            <li>Slow network connections (2G or slower)</li>
            <li>Devices with less than 4 CPU cores</li>
            <li>Low memory devices (&lt;4GB RAM)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MotionTestComponent;
