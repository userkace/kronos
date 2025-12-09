import React, { useState } from 'react';
import TimezoneSelect from './TimezoneSelect';
import { Clock, Calendar, Globe, ArrowRight, CheckCircle, Settings as SettingsIcon } from 'lucide-react';

const Onboarding = ({ onComplete, initialTimezone = 'UTC' }) => {
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [weekStart, setWeekStart] = useState('sunday');
  const [currentStep, setCurrentStep] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete({
      timezone: selectedTimezone,
      weekStart: weekStart
    });
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    {
      title: "Welcome to Kronos",
      subtitle: "Let's set up your time tracking preferences",
      icon: Clock,
      color: "blue"
    },
    {
      title: "Set Your Timezone",
      subtitle: "Choose your local timezone",
      icon: Globe,
      color: "green"
    },
    {
      title: "Week Configuration",
      subtitle: "Select your week start day",
      icon: Calendar,
      color: "purple"
    }
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header with Progress */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <div className="flex items-center justify-center mb-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <React.Fragment key={index}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-green-500' : isActive ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-24 h-1 mx-3 transition-all duration-300 ${
                      isCompleted ? 'bg-green-400' : 'bg-blue-400'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">{steps[currentStep].title}</h1>
            <p className="text-blue-100">{steps[currentStep].subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {currentStep === 0 ? (
            // Welcome Step
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                  <Clock className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">Start Tracking Your Time</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Kronos helps you track your work hours, manage timesheets, and stay productive. 
                    Let's get you set up in just a few steps.
                  </p>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <Globe className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Timezone Aware</h3>
                  <p className="text-sm text-gray-600">Track time in your local timezone</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <Calendar className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Weekly Views</h3>
                  <p className="text-sm text-gray-600">See your week at a glance</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Easy Export</h3>
                  <p className="text-sm text-gray-600">Backup your data anytime</p>
                </div>
              </div>

              <button
                onClick={nextStep}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition duration-200 font-medium flex items-center justify-center space-x-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : currentStep === 1 ? (
            // Timezone Step
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <Globe className="w-10 h-10 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">Set Your Timezone</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Select your local timezone for accurate time tracking throughout the app.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Globe className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Your Timezone</h3>
                </div>
                <div className="space-y-3">
                  <TimezoneSelect
                    timezone={selectedTimezone}
                    onTimezoneChange={setSelectedTimezone}
                  />
                  <p className="text-sm text-gray-600">
                    Choose your local timezone to ensure all time entries are recorded correctly.
                  </p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition duration-200 font-medium"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 bg-linear-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition duration-200 font-medium flex items-center justify-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            // Week Start Step
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
                  <Calendar className="w-10 h-10 text-purple-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">Week Configuration</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Choose which day your week starts on for consistent weekly views.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Week Start Day</h3>
                </div>
                <div className="space-y-3">
                  <select
                    id="weekStart"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                  <p className="text-sm text-gray-600">
                    Select the day that your week begins. This affects how your weekly timesheets are organized.
                  </p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition duration-200 font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-linear-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition duration-200 font-medium flex items-center justify-center space-x-2"
                >
                  <span>Complete Setup</span>
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
