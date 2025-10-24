/**
 * AssignmentDialog - Modal for assigning projects to users
 */

import React, { useState, useEffect } from 'react';

const AssignmentDialog = ({ isOpen, onClose, onAssign, users, projects, editAssignment = null }) => {
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    rfaNumber: '',
    userId: '',
    hoursAllocated: 8,
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    status: 'ASSIGNED',
    priority: 'medium',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when editing
  useEffect(() => {
    if (editAssignment) {
      setFormData({
        projectId: editAssignment.projectId || '',
        projectName: editAssignment.projectName || '',
        rfaNumber: editAssignment.rfaNumber || '',
        userId: editAssignment.userId || '',
        hoursAllocated: editAssignment.hoursAllocated || 8,
        startDate: editAssignment.startDate || new Date().toISOString().split('T')[0],
        dueDate: editAssignment.dueDate || '',
        status: editAssignment.status || 'ASSIGNED',
        priority: editAssignment.priority || 'medium',
        notes: editAssignment.notes || ''
      });
    } else {
      // Reset form for new assignment
      setFormData({
        projectId: '',
        projectName: '',
        rfaNumber: '',
        userId: '',
        hoursAllocated: 8,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        status: 'ASSIGNED',
        priority: 'medium',
        notes: ''
      });
    }
    setErrors({});
  }, [editAssignment, isOpen]);

  // Handle project selection
  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    const selectedProject = projects.find(p => p.id === projectId);
    
    if (selectedProject) {
      setFormData(prev => ({
        ...prev,
        projectId: selectedProject.id,
        projectName: selectedProject.projectName || '',
        rfaNumber: selectedProject.rfaNumber || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        projectId: '',
        projectName: '',
        rfaNumber: ''
      }));
    }
    
    if (errors.projectId) {
      setErrors(prev => ({ ...prev, projectId: undefined }));
    }
  };

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.projectId) {
      newErrors.projectId = 'Please select a project';
    }

    if (!formData.userId) {
      newErrors.userId = 'Please select a user';
    }

    if (!formData.hoursAllocated || formData.hoursAllocated < 0) {
      newErrors.hoursAllocated = 'Hours must be greater than 0';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    if (formData.dueDate && formData.startDate && new Date(formData.dueDate) < new Date(formData.startDate)) {
      newErrors.dueDate = 'Due date cannot be before start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const assignmentData = {
        ...formData,
        id: editAssignment?.id, // Keep existing ID if editing
        hoursAllocated: parseFloat(formData.hoursAllocated),
        hoursSpent: editAssignment?.hoursSpent || 0 // Preserve hours spent when editing
      };

      await onAssign(assignmentData);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create assignment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90%] max-w-2xl max-h-[90vh] flex flex-col animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {editAssignment ? '✏️ Edit Assignment' : '➕ Assign Project'}
          </h2>
          <button 
            className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xl text-gray-600 dark:text-gray-300 transition-all" 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form className="p-6 overflow-y-auto flex-1 space-y-5" onSubmit={handleSubmit}>
          {/* Project Selection */}
          <div>
            <label htmlFor="project" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Project <span className="text-error-600 dark:text-error-400">*</span>
            </label>
            <select
              id="project"
              value={formData.projectId}
              onChange={handleProjectChange}
              className={`w-full px-3 py-2 border rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 ${
                errors.projectId ? 'border-error-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={editAssignment}
            >
              <option value="">Select a project...</option>
              {projects && projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.rfaNumber} - {project.projectName}
                </option>
              ))}
            </select>
            {errors.projectId && <span className="text-error-600 dark:text-error-400 text-xs mt-1 block">{errors.projectId}</span>}
          </div>

          {/* User Selection */}
          <div>
            <label htmlFor="user" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Assign To <span className="text-error-600 dark:text-error-400">*</span>
            </label>
            <select
              id="user"
              value={formData.userId}
              onChange={(e) => handleChange('userId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.userId ? 'border-error-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">Select a user...</option>
              {users && users.filter(u => u.isActive).map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            {errors.userId && <span className="text-error-600 dark:text-error-400 text-xs mt-1 block">{errors.userId}</span>}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Start Date <span className="text-error-600 dark:text-error-400">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.startDate ? 'border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.startDate && <span className="text-error-600 dark:text-error-400 text-xs mt-1 block">{errors.startDate}</span>}
            </div>

            <div>
              <label htmlFor="dueDate" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Due Date <span className="text-error-600 dark:text-error-400">*</span>
              </label>
              <input
                type="date"
                id="dueDate"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.dueDate ? 'border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.dueDate && <span className="text-error-600 dark:text-error-400 text-xs mt-1 block">{errors.dueDate}</span>}
            </div>
          </div>

          {/* Hours and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hours" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Hours Allocated <span className="text-error-600 dark:text-error-400">*</span>
              </label>
              <input
                type="number"
                id="hours"
                min="0"
                step="0.5"
                value={formData.hoursAllocated}
                onChange={(e) => handleChange('hoursAllocated', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.hoursAllocated ? 'border-error-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.hoursAllocated && <span className="text-error-600 dark:text-error-400 text-xs mt-1 block">{errors.hoursAllocated}</span>}
            </div>

            <div>
              <label htmlFor="priority" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Priority</label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>

          {/* Status (if editing) */}
          {editAssignment && (
            <div>
              <label htmlFor="status" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="ASSIGNED">📋 Assigned</option>
                <option value="IN PROGRESS">⚡ In Progress</option>
                <option value="IN QC">🔍 In QC</option>
                <option value="PAUSE">⏸️ Paused</option>
                <option value="COMPLETE">✅ Complete</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              id="notes"
              rows="3"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add any additional notes or instructions..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 resize-y transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-error-50 dark:bg-error-900/20 border-l-4 border-error-500 rounded text-error-800 dark:text-error-200 text-sm">
              ⚠️ {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all disabled:opacity-50"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {isSubmitting ? 'Saving...' : (editAssignment ? 'Update Assignment' : 'Create Assignment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignmentDialog;

