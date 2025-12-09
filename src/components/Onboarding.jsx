import React, { useState } from 'react';
import TimezoneSelect from './TimezoneSelect';

const Onboarding = ({ onComplete, initialTimezone = 'UTC' }) => {
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [weekStart, setWeekStart] = useState('sunday');

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete({
      timezone: selectedTimezone,
      weekStart: weekStart
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Kronos</h1>
          <p className="text-gray-600">Let's set up your time tracking preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
              Your Timezone
            </label>
            <TimezoneSelect
              timezone={selectedTimezone}
              onTimezoneChange={setSelectedTimezone}
            />
            <p className="mt-1 text-sm text-gray-500">
              Select your local timezone for accurate time tracking
            </p>
          </div>

          <div>
            <label htmlFor="weekStart" className="block text-sm font-medium text-gray-700 mb-2">
              Start of the Week
            </label>
            <select
              id="weekStart"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Choose which day your week starts on
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 font-medium"
          >
            Get Started
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
