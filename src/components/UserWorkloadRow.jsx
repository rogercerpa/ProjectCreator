/**
 * UserWorkloadRow - Individual user row in workload grid
 */

import React from 'react';
import ProjectAssignmentCard from './ProjectAssignmentCard';
import CapacityBar from './CapacityBar';
import UserPresenceIndicator from './UserPresenceIndicator';
import './UserWorkloadRow.css';

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
    <div className="user-workload-row">
      {/* User Info Column */}
      <div className="row-cell user-cell">
        <UserPresenceIndicator isOnline={isOnline} />
        <div className="user-info">
          <div className="user-name">{user.name}</div>
          <div className="user-role">{user.role || 'Designer'}</div>
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
            className={`row-cell date-cell ${isToday(date) ? 'today' : ''}`}
          >
            <div className="date-cell-content">
              {/* Hours indicator */}
              {hours > 0 && (
                <div className={`hours-badge ${isOverCapacity ? 'over-capacity' : ''}`}>
                  {Math.round(hours)}h
                </div>
              )}
              
              {/* Assignment indicators */}
              <div className="assignments-container">
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
                  <div className="more-assignments">
                    +{dateAssignments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Capacity Column */}
      <div className="row-cell capacity-cell">
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

