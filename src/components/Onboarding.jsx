import React, { useState } from 'react';
import TimezoneSelect from './TimezoneSelect';
import { Clock, Calendar, Globe, ArrowRight, CheckCircle, Settings as SettingsIcon, Building2 } from 'lucide-react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Onboarding = ({ onComplete, initialTimezone = 'UTC' }) => {
  const [selectedTimezone, setSelectedTimezone] = useState(initialTimezone);
  const [weekStart, setWeekStart] = useState('sunday');
  const [weekendDays, setWeekendDays] = useState([0, 6]);
  const [currentStep, setCurrentStep] = useState(0);

  const toggleWeekendDay = (idx) => {
    setWeekendDays(prev =>
      prev.includes(idx)
        ? prev.filter(d => d !== idx)
        : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete({
      timezone: selectedTimezone,
      weekStart: weekStart,
      weekendDays: weekendDays,
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
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-lg max-w-2xl w-full overflow-hidden">
        {/* Header with Progress */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <div className="flex items-center justify-center mb-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <React.Fragment key={index}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-300 ${
                    isCompleted ? 'bg-green-500' : isActive ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-24 h-1 mx-3 rounded-full transition-colors duration-300 ${
                      isCompleted ? 'bg-green-400' : 'bg-blue-400'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{steps[currentStep].title}</h1>
            <p className="text-blue-100">{steps[currentStep].subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {currentStep === 0 ? (
            // Welcome Step
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                  <Clock className="w-10 h-10 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">Start Tracking Your Time</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Kronos helps you track your work hours, manage timesheets, and stay productive. 
                    Let's get you set up in just a few steps.
                  </p>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <Globe className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Timezone Aware</h3>
                  <p className="text-sm text-gray-600">Track time in your local timezone</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <Calendar className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Weekly Views</h3>
                  <p className="text-sm text-gray-600">See your week at a glance</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h3 className="font-medium text-gray-900 mb-1">Easy Export</h3>
                  <p className="text-sm text-gray-600">Backup your data anytime</p>
                </div>
              </div>

              <button
                onClick={nextStep}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-6 rounded-lg shadow-xs transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : currentStep === 1 ? (
            // Timezone Step
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <Globe className="w-10 h-10 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">Set Your Timezone</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Select your local timezone for accurate time tracking throughout the app.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-5 h-5 text-green-600" />
                  <h3 className="text-base font-semibold text-gray-900 tracking-tight">Your Timezone</h3>
                </div>
                <div className="space-y-3">
                  <TimezoneSelect
                    timezone={selectedTimezone}
                    onTimezoneChange={setSelectedTimezone}
                  />
                  <div className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                    <Building2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">Working remotely?</span> If your company is in a different timezone, you can set this to their location so your tracked hours align with their business hours instead of your local time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 px-6 rounded-lg shadow-xs hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 text-sm font-medium"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-6 rounded-lg shadow-xs transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            // Week Start Step
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
                  <Calendar className="w-10 h-10 text-purple-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">Week Configuration</h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Choose which day your week starts on for consistent weekly views.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-semibold text-gray-900 tracking-tight">Week Start Day</h3>
                </div>
                <div className="space-y-3">
                  <select
                    id="weekStart"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                  <p className="text-sm text-gray-600">
                    Select the day that your week begins. This affects how your weekly timesheets are organized.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-semibold text-gray-900 tracking-tight">Non-Work Days</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, idx) => {
                      const isSelected = weekendDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleWeekendDay(idx)}
                          aria-pressed={isSelected}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-150 ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-xs'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-gray-600">
                    Days you don't normally work. Skipping these won't break your tracking streak. You can change this later in Settings.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 px-6 rounded-lg shadow-xs hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-6 rounded-lg shadow-xs transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2"
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
