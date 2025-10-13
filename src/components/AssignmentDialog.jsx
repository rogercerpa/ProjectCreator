/**
 * AssignmentDialog - Modal for assigning projects to users
 */

import React, { useState, useEffect } from 'react';
import './AssignmentDialog.css';

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
    <div className="assignment-dialog-overlay" onClick={onClose}>
      <div className="assignment-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>{editAssignment ? '✏️ Edit Assignment' : '➕ Assign Project'}</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <form className="dialog-body" onSubmit={handleSubmit}>
          {/* Project Selection */}
          <div className="form-group">
            <label htmlFor="project">
              Project <span className="required">*</span>
            </label>
            <select
              id="project"
              value={formData.projectId}
              onChange={handleProjectChange}
              className={errors.projectId ? 'error' : ''}
              disabled={editAssignment} // Can't change project when editing
            >
              <option value="">Select a project...</option>
              {projects && projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.rfaNumber} - {project.projectName}
                </option>
              ))}
            </select>
            {errors.projectId && <span className="error-message">{errors.projectId}</span>}
          </div>

          {/* User Selection */}
          <div className="form-group">
            <label htmlFor="user">
              Assign To <span className="required">*</span>
            </label>
            <select
              id="user"
              value={formData.userId}
              onChange={(e) => handleChange('userId', e.target.value)}
              className={errors.userId ? 'error' : ''}
            >
              <option value="">Select a user...</option>
              {users && users.filter(u => u.isActive).map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            {errors.userId && <span className="error-message">{errors.userId}</span>}
          </div>

          {/* Date Range */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">
                Start Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className={errors.startDate ? 'error' : ''}
              />
              {errors.startDate && <span className="error-message">{errors.startDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">
                Due Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="dueDate"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                className={errors.dueDate ? 'error' : ''}
              />
              {errors.dueDate && <span className="error-message">{errors.dueDate}</span>}
            </div>
          </div>

          {/* Hours and Priority */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hours">
                Hours Allocated <span className="required">*</span>
              </label>
              <input
                type="number"
                id="hours"
                min="0"
                step="0.5"
                value={formData.hoursAllocated}
                onChange={(e) => handleChange('hoursAllocated', e.target.value)}
                className={errors.hoursAllocated ? 'error' : ''}
              />
              {errors.hoursAllocated && <span className="error-message">{errors.hoursAllocated}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
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
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
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
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              rows="3"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add any additional notes or instructions..."
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="error-banner">
              ⚠️ {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="dialog-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (editAssignment ? 'Update Assignment' : 'Create Assignment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignmentDialog;

