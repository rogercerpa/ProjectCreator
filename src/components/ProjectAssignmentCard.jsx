/**
 * ProjectAssignmentCard - Display individual project assignment
 */

import React from 'react';
import './ProjectAssignmentCard.css';

const ProjectAssignmentCard = ({
  assignment,
  compact = false,
  statusColor,
  onClick
}) => {
  
  /**
   * Get priority icon
   */
  const getPriorityIcon = () => {
    switch (assignment.priority?.toLowerCase()) {
      case 'urgent':
        return '🔥';
      case 'high':
        return '⬆️';
      case 'low':
        return '⬇️';
      default:
        return '';
    }
  };

  /**
   * Check if overdue
   */
  const isOverdue = () => {
    if (!assignment.dueDate || assignment.status === 'COMPLETE') return false;
    return new Date(assignment.dueDate) < new Date();
  };

  /**
   * Get days until due
   */
  const getDaysUntilDue = () => {
    if (!assignment.dueDate) return null;
    const dueDate = new Date(assignment.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();
  const overdue = isOverdue();
  const priorityIcon = getPriorityIcon();

  if (compact) {
    return (
      <div
        className={`assignment-card-compact ${overdue ? 'overdue' : ''}`}
        style={{ borderLeftColor: statusColor }}
        onClick={onClick}
        title={`${assignment.projectName || assignment.rfaNumber} - ${assignment.status}`}
      >
        <div className="card-compact-header">
          <span className="card-compact-title">
            {priorityIcon && <span className="priority-icon">{priorityIcon}</span>}
            {assignment.projectName || assignment.rfaNumber || assignment.projectId}
          </span>
          {daysUntilDue !== null && !overdue && (
            <span className="card-compact-days">
              {daysUntilDue}d
            </span>
          )}
          {overdue && (
            <span className="card-compact-overdue">!</span>
          )}
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div
      className={`assignment-card ${overdue ? 'overdue' : ''}`}
      style={{ borderLeftColor: statusColor }}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-title">
          {priorityIcon && <span className="priority-icon">{priorityIcon}</span>}
          {assignment.projectName || assignment.rfaNumber || assignment.projectId}
        </div>
        <div className="card-status" style={{ backgroundColor: statusColor }}>
          {assignment.status || 'ASSIGNED'}
        </div>
      </div>

      <div className="card-body">
        <div className="card-info-row">
          <span className="card-label">RFA:</span>
          <span className="card-value">{assignment.rfaNumber || '-'}</span>
        </div>

        <div className="card-info-row">
          <span className="card-label">Hours:</span>
          <span className="card-value">
            {assignment.hoursSpent || 0} / {assignment.hoursAllocated || 0}
          </span>
        </div>

        {assignment.dueDate && (
          <div className="card-info-row">
            <span className="card-label">Due:</span>
            <span className={`card-value ${overdue ? 'text-danger' : ''}`}>
              {new Date(assignment.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
              {daysUntilDue !== null && (
                <span className="days-badge">
                  {overdue ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {assignment.hoursAllocated > 0 && (
        <div className="card-progress">
          <div
            className="card-progress-bar"
            style={{
              width: `${Math.min(100, (assignment.hoursSpent / assignment.hoursAllocated) * 100)}%`,
              backgroundColor: statusColor
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ProjectAssignmentCard;

