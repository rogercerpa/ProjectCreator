/**
 * UserWorkloadRow - Individual user row in workload grid
 */

import React from 'react';
import ProjectAssignmentCard from '../ProjectAssignmentCard';
import CapacityBar from '../CapacityBar';
import UserPresenceIndicator from '../UserPresenceIndicator';

const UserWorkloadRow = ({
  user,
  isOnline,
  dateRange,
  assignments,
  capacity,
  onAssignmentClick,
  onUpdateAssignment,
  onDeleteAssignment
}) => {
  
  /**
   * Get assignments for specific date
   */
  const getAssignmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    return assignments.filter(assignment => {
      const startDate = new Date(assignment.startDate).toISOString().split('T')[0];
      const endDate = assignment.dueDate 
        ? new Date(assignment.dueDate).toISOString().split('T')[0]
        : startDate;
      
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  /**
   * Calculate hours for date
   */
  const calculateHoursForDate = (date) => {
    const dateAssignments = getAssignmentsForDate(date);
    return dateAssignments.reduce((sum, a) => {
      // Estimate daily hours (total hours / days between start and due)
      const start = new Date(a.startDate);
      const end = a.dueDate ? new Date(a.dueDate) : start;
      const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      return sum + (a.hoursAllocated / days);
    }, 0);
  };

  /**
   * Check if date is today
   */
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ASSIGNED':
        return '#95a5a6';
      case 'IN PROGRESS':
        return '#f39c12';
      case 'IN QC':
        return '#3498db';
      case 'COMPLETE':
        return '#27ae60';
      case 'PAUSE':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  return (
    <div className="grid gap-0 border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" 
         style={{ gridTemplateColumns: '200px repeat(auto-fit, minmax(120px, 1fr)) 120px' }}>
      {/* User Info Column */}
      <div className="flex items-center pl-5 pr-2.5 py-4 border-r border-gray-200 dark:border-gray-700 min-h-[80px] gap-3 md:pl-4 md:gap-2.5 sm:pl-3 sm:gap-2">
        <UserPresenceIndicator isOnline={isOnline} />
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px] sm:text-xs">
            {user.name}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 sm:hidden">
            {user.role || 'Designer'}
          </div>
        </div>
      </div>

      {/* Date Columns */}
      {dateRange.map((date, index) => {
        const dateAssignments = getAssignmentsForDate(date);
        const hours = calculateHoursForDate(date);
        const dailyCapacity = (user.weeklyCapacity || 40) / 5; // Assuming 5-day week
        const isOverCapacity = hours > dailyCapacity;
        
        return (
          <div
            key={index}
            className={`flex flex-col items-stretch p-2 border-r border-gray-200 dark:border-gray-700 min-h-[80px] relative ${
              isToday(date) ? 'bg-blue-50 dark:bg-primary-900/20' : ''
            } md:p-2 sm:p-1.5`}
          >
            <div className="flex flex-col gap-1.5 w-full">
              {/* Hours indicator */}
              {hours > 0 && (
                <div 
                  className={`self-start px-2 py-1 text-xs font-bold rounded ${
                    isOverCapacity 
                      ? 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400' 
                      : 'bg-info-100 dark:bg-info-900/30 text-info-600 dark:text-info-400'
                  } md:px-1.5 md:py-0.5 md:text-[10px] sm:px-1 sm:py-0.5 sm:text-[9px]`}
                >
                  {Math.round(hours)}h
                </div>
              )}
              
              {/* Assignment indicators */}
              <div className="flex flex-col gap-1 w-full">
                {dateAssignments.slice(0, 3).map((assignment) => (
                  <ProjectAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    compact={true}
                    statusColor={getStatusColor(assignment.status)}
                    onClick={() => onAssignmentClick(assignment)}
                  />
                ))}
                
                {/* Show +N more if there are more assignments */}
                {dateAssignments.length > 3 && (
                  <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold rounded text-center cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-300 md:text-[10px] md:px-1.5 sm:text-[10px] sm:px-1.5">
                    +{dateAssignments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Capacity Column */}
      <div className="flex items-center justify-center p-2.5 min-h-[80px]">
        <CapacityBar
          percentage={capacity.percentage}
          allocated={capacity.totalAllocated}
          total={capacity.weeklyCapacity}
        />
      </div>
    </div>
  );
};

export default UserWorkloadRow;
