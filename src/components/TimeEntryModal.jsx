import React, { useState, useEffect } from 'react';
import { format, addMinutes, differenceInMinutes, parse, isValid, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { 
  Menu, 
  Clipboard, 
  Folder, 
  Tag, 
  Trash2, 
  X, 
  Clock
} from 'lucide-react';

const TimeEntryModal = ({ 
  isOpen, 
  mode, 
  initialData, 
  onSave, 
  onDelete, 
  onClose,
  timezone,
  selectedDate
}) => {
  const [formData, setFormData] = useState({
    description: '',
    task: '',
    project: '',
    tags: '',
    startTime: '',
    endTime: '',
    duration: ''
  });

  // Timezone mode state
  const [timezoneMode, setTimezoneMode] = useState('selected'); // 'selected' or 'custom'
  const [entryTimezone, setEntryTimezone] = useState(timezone || 'UTC');

  // Common timezones for dropdown
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Asia/Dubai'
  ];

  // Mock data for dropdowns (can be replaced with real data later)
  const tasks = ['Development', 'Meeting', 'Design', 'Research', 'Testing'];
  const projects = ['Project Alpha', 'Project Beta', 'Project Gamma', 'Personal'];
  const availableTags = ['urgent', 'client-work', 'internal', 'review', 'bug-fix'];

  // Initialize form with initialData if editing
  useEffect(() => {
    if (initialData && mode === 'edit') {
      // Convert UTC storage times to selected timezone for display (HH:mm:ss format)
      const startTimeInTimezone = initialData.startTime ? format(toZonedTime(parseISO(initialData.startTime), timezone), 'HH:mm:ss') : '';
      const endTimeInTimezone = initialData.endTime ? format(toZonedTime(parseISO(initialData.endTime), timezone), 'HH:mm:ss') : '';
      
      // Determine the entry date - use stored date if available, otherwise derive from startTime
      let entryDate = initialData.date;
      if (!entryDate && initialData.startTime) {
        // For timer entries without a date field, derive date from startTime in selected timezone
        entryDate = format(toZonedTime(parseISO(initialData.startTime), timezone), 'yyyy-MM-dd');
      }
      
      setFormData({
        description: initialData.description || '',
        task: initialData.task || '',
        project: initialData.project || '',
        tags: initialData.tags || '',
        startTime: startTimeInTimezone,
        endTime: endTimeInTimezone,
        duration: initialData.duration || ''
      });
    } else if (mode === 'add') {
      // Reset form for new entry
      setFormData({
        description: '',
        task: '',
        project: '',
        tags: '',
        startTime: '',
        endTime: '',
        duration: ''
      });
    }
  }, [initialData, mode]);

  // Parse duration string to minutes
  const parseDuration = (durationStr) => {
    if (!durationStr) return 0;
    
    const hoursMatch = durationStr.match(/(\d+)\s*h/);
    const minutesMatch = durationStr.match(/(\d+)\s*min/);
    
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    
    return (hours * 60) + minutes;
  };

  // Format minutes to duration string
  const formatDuration = (minutes) => {
    if (minutes <= 0) return '';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours} h ${mins} min`;
  };

  // Calculate duration from start and end times
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    
    try {
      const start = parse(startTime, 'HH:mm:ss', new Date());
      const end = parse(endTime, 'HH:mm:ss', new Date());
      
      if (!isValid(start) || !isValid(end)) return '';
      
      let diffMinutes = differenceInMinutes(end, start);
      
      // Handle overnight shifts
      if (diffMinutes < 0) {
        diffMinutes = differenceInMinutes(end, start) + (24 * 60);
      }
      
      return formatDuration(diffMinutes);
    } catch (error) {
      return '';
    }
  };

  // Calculate end time from start time and duration
  const calculateEndTime = (startTime, durationStr) => {
    if (!startTime || !durationStr) return '';
    
    try {
      const start = parse(startTime, 'HH:mm:ss', new Date());
      const durationMinutes = parseDuration(durationStr);
      
      if (!isValid(start) || durationMinutes < 0) return '';
      
      const end = addMinutes(start, durationMinutes);
      return format(end, 'HH:mm:ss');
    } catch (error) {
      return '';
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    
    // Auto-calculation logic
    if (field === 'startTime' || field === 'endTime') {
      const duration = calculateDuration(
        field === 'startTime' ? value : formData.startTime,
        field === 'endTime' ? value : formData.endTime
      );
      newFormData.duration = duration;
    } else if (field === 'duration') {
      const endTime = calculateEndTime(formData.startTime, value);
      newFormData.endTime = endTime;
    }
    
    setFormData(newFormData);
  };

  // Handle save
  const handleSave = () => {
    // Validate required fields
    if (!formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    
    if (!formData.startTime || !formData.endTime) {
      alert('Please enter both start and end times');
      return;
    }
    
    // Validate time format
    try {
      parse(formData.startTime, 'HH:mm:ss', new Date());
      parse(formData.endTime, 'HH:mm:ss', new Date());
    } catch (error) {
      alert('Invalid time format. Please use HH:MM:SS format');
      return;
    }
    
    // Pass timezone mode information to parent
    const entryData = {
      ...formData,
      timezoneMode,
      entryTimezone: timezoneMode === 'custom' ? entryTimezone : timezone
    };
    
    onSave(entryData);
  };

  // Handle delete
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this time entry?')) {
      onDelete(initialData);
    }
  };

  // Handle close
  const handleClose = () => {
    if (mode === 'edit' && 
        JSON.stringify(formData) !== JSON.stringify({
          description: initialData?.description || '',
          task: initialData?.task || '',
          project: initialData?.project || '',
          tags: initialData?.tags || '',
          startTime: initialData?.startTime || '',
          endTime: initialData?.endTime || '',
          duration: initialData?.duration || '',
          date: initialData?.date || format(new Date(), 'yyyy-MM-dd')
        })) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 bg-opacity-50 backdrop-blur-[1px]"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'edit' ? 'Edit Time Entry' : 'New Time Entry'}
            </h2>
            {mode === 'add' && selectedDate && (
              <p className="text-sm text-gray-500 mt-1">
                for {format(toZonedTime(selectedDate, timezone), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {mode === 'edit' && (
              <button
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Menu className="w-4 h-4 mr-2" />
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="What are you working on?"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Task Selector */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Clipboard className="w-4 h-4 mr-2" />
              Select Task
            </label>
            <select
              value={formData.task}
              onChange={(e) => handleInputChange('task', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a task...</option>
              {tasks.map(task => (
                <option key={task} value={task}>{task}</option>
              ))}
            </select>
          </div>

          {/* Project Selector */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Folder className="w-4 h-4 mr-2" />
              Select Project
            </label>
            <select
              value={formData.project}
              onChange={(e) => handleInputChange('project', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a project...</option>
              {projects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Tag className="w-4 h-4 mr-2" />
              Add Tags
            </label>
            <select
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select tags...</option>
              {availableTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Timezone Mode Section */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <Clock className="w-4 h-4 mr-2" />
              Timezone Mode
            </label>
            
            {/* Mode Selection */}
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timezoneMode"
                  value="selected"
                  checked={timezoneMode === 'selected'}
                  onChange={(e) => setTimezoneMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Use Selected Timezone ({timezone})
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="timezoneMode"
                  value="custom"
                  checked={timezoneMode === 'custom'}
                  onChange={(e) => setTimezoneMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Custom Timezone
                </span>
              </label>
            </div>
            
            {/* Custom Timezone Selector */}
            {timezoneMode === 'custom' && (
              <div className="mt-2">
                <select
                  value={entryTimezone}
                  onChange={(e) => setEntryTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {commonTimezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Times will be interpreted as {entryTimezone} and converted to UTC
                </p>
              </div>
            )}
          </div>

          {/* Time & Date Section */}
          <div className="space-y-3">
            {/* Time Row */}
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 mr-2" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  step="1"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-center pt-6">
                <span className="text-gray-500">→</span>
              </div>
              
              <div className="flex-1">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 mr-2" />
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  step="1"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="flex-1">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 mr-2" />
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  placeholder="e.g., 1 h 30 min"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

                      </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeEntryModal;
