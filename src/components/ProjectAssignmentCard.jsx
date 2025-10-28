/**
 * ProjectAssignmentCard - Display individual project assignment
 */

import React from 'react';

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
        className={`px-2 py-1.5 bg-white dark:bg-gray-800 border-l-[3px] rounded cursor-pointer transition-all shadow-sm hover:translate-x-0.5 hover:shadow-md ${
          overdue ? 'bg-error-50 dark:bg-error-900/20' : ''
        }`}
        style={{ borderLeftColor: statusColor }}
        onClick={onClick}
        title={`${assignment.projectName || assignment.rfaNumber} - ${assignment.status}`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis flex-1 flex items-center gap-1 sm:text-[10px]">
            {priorityIcon && <span className="text-[10px]">{priorityIcon}</span>}
            {assignment.projectName || assignment.rfaNumber || assignment.projectId}
          </span>
          {daysUntilDue !== null && !overdue && (
            <span className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded sm:text-[9px]">
              {daysUntilDue}d
            </span>
          )}
          {overdue && (
            <span className="text-xs text-error-600 dark:text-error-400 font-bold">!</span>
          )}
        </div>
      </div>
    );
  }

  // Full card view
  return (
    <div
      className={`p-3 bg-white dark:bg-gray-800 border-l-4 rounded-md cursor-pointer transition-all shadow-md hover:-translate-y-0.5 hover:shadow-lg max-w-[300px] md:max-w-full ${
        overdue ? 'bg-error-50 dark:bg-error-900/20' : ''
      }`}
      style={{ borderLeftColor: statusColor }}
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-2.5 mb-3">
        <div className="text-sm font-bold text-gray-800 dark:text-gray-200 flex-1 flex items-center gap-1.5">
          {priorityIcon && <span className="text-xs">{priorityIcon}</span>}
          {assignment.projectName || assignment.rfaNumber || assignment.projectId}
        </div>
        <div 
          className="px-2 py-1 text-[10px] font-bold text-white rounded uppercase whitespace-nowrap"
          style={{ backgroundColor: statusColor }}
        >
          {assignment.status || 'ASSIGNED'}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-semibold">RFA:</span>
          <span className="text-gray-800 dark:text-gray-200 font-medium">{assignment.rfaNumber || '-'}</span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-semibold">Hours:</span>
          <span className="text-gray-800 dark:text-gray-200 font-medium">
            {assignment.hoursSpent || 0} / {assignment.hoursAllocated || 0}
          </span>
        </div>

        {assignment.dueDate && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600 dark:text-gray-400 font-semibold">Due:</span>
            <span className={`font-medium flex items-center gap-1.5 ${
              overdue ? 'text-error-600 dark:text-error-400' : 'text-gray-800 dark:text-gray-200'
            }`}>
              {new Date(assignment.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
              {daysUntilDue !== null && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded">
                  {overdue ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {assignment.hoursAllocated > 0 && (
        <div className="mt-2.5 h-1 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out rounded"
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

