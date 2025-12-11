import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const EditEntryModal = ({ isOpen, onClose, entry, onSaveEntry }) => {
  const [description, setDescription] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [tags, setTags] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const isRunningTimer = entry && entry.isRunning;

  const tasks = [
    'Website Development',
    'Client Meeting',
    'Code Review',
    'Research',
    'Documentation',
    'Bug Fixing',
    'Planning'
  ];

  const projects = [
    'Website Build - Launch',
    'Mobile App Development',
    'API Integration',
    'Database Migration',
    'UI/UX Redesign'
  ];

  useEffect(() => {
    if (entry) {
      setDescription(entry.description || '');
      setSelectedTask(entry.task || '');
      setSelectedProject(entry.project || '');
      setTags(entry.tags || '');
      setStartTime(entry.startTime ? format(new Date(entry.startTime), 'HH:mm') : '');
      setEndTime(entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : '');
    }
  }, [entry]);

  const handleSave = () => {
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    if (!isRunningTimer && (!startTime || !endTime)) {
      alert('Please enter both start and end times');
      return;
    }

    try {
      let updatedEntry = {
        ...entry,
        description: description.trim(),
        task: selectedTask,
        project: selectedProject,
        tags: tags.trim()
      };

      if (!isRunningTimer) {
        // Only update times for completed entries
        const originalDate = new Date(entry.startTime);

        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);

        if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
          alert('Invalid time format');
          return;
        }

        const updatedStartTime = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate(), startHours, startMinutes, 0, 0);

        const updatedEndTime = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate(), endHours, endMinutes, 0, 0);

        if (updatedEndTime < updatedStartTime) {
          updatedEndTime.setDate(updatedEndTime.getDate() + 1);
        }

        updatedEntry.startTime = updatedStartTime;
        updatedEntry.endTime = updatedEndTime;

        const duration = Math.floor((updatedEndTime - updatedStartTime) / 1000);
        updatedEntry.duration = duration;
        updatedEntry.durationFormatted = formatDuration(duration);
      }

      onSaveEntry(updatedEntry);
      onClose();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Error saving entry. Please check your input.');
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} h ${minutes} min`;
    }
    return `${minutes} min`;
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 bg-black/10 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isRunningTimer ? 'Edit Current Task' : 'Edit Time Entry'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm underline"
          >
            Cancel
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              What did you work on?
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter task description..."
              autoFocus
            />
          </div>

          {/* Task Selection */}
          <div>
            <label htmlFor="task" className="block text-sm font-medium text-gray-700 mb-2">
              Select Task
            </label>
            <select
              id="task"
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Select a task...</option>
              {tasks.map((task) => (
                <option key={task} value={task}>
                  {task}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selection */}
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
              Select Project
            </label>
            <select
              id="project"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              Add Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter tags separated by commas..."
            />
          </div>

          {/* Time Range - Only show for completed entries */}
          {!isRunningTimer && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Running Timer Info */}
          {isRunningTimer && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                This is a running timer. Only the task details can be edited while it's running.
                The timer will continue running with the updated details.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || (!isRunningTimer && (!startTime || !endTime))}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEntryModal;
