/**
 * WorkloadGrid - Main grid displaying users and their assignments
 */

import React, { useState, useMemo } from 'react';
import UserWorkloadRow from './UserWorkloadRow';
import './WorkloadGrid.css';

const WorkloadGrid = ({
  users,
  assignments,
  viewMode,
  selectedDate,
  onlineUsers,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment
}) => {
  
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  /**
   * Get date range based on view mode
   */
  const getDateRange = () => {
    const dates = [];
    const start = new Date(selectedDate);

    switch (viewMode) {
      case 'day':
        dates.push(new Date(start));
        break;
        
      case 'week':
        // Get Monday of the week
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        
        for (let i = 0; i < 5; i++) { // Monday to Friday
          dates.push(new Date(start));
          start.setDate(start.getDate() + 1);
        }
        break;
        
      case 'month':
        // Get all days of the month
        const year = start.getFullYear();
        const month = start.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          // Only include weekdays
          if (date.getDay() !== 0 && date.getDay() !== 6) {
            dates.push(date);
          }
        }
        break;
        
      default:
        break;
    }

    return dates;
  };

  /**
   * Get assignments for user and date
   */
  const getAssignmentsForUserAndDate = (userId, date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    return assignments.filter(assignment => {
      if (assignment.userId !== userId) return false;
      
      const startDate = new Date(assignment.startDate).toISOString().split('T')[0];
      const endDate = assignment.dueDate 
        ? new Date(assignment.dueDate).toISOString().split('T')[0]
        : startDate;
      
      return dateStr >= startDate && dateStr <= endDate;
    });
  };

  /**
   * Calculate user capacity for date range
   */
  const calculateUserCapacity = (userId) => {
    const userAssignments = assignments.filter(a => a.userId === userId);
    const totalAllocated = userAssignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
    
    // Assuming 40 hours per week capacity
    const user = users.find(u => u.id === userId);
    const weeklyCapacity = user?.weeklyCapacity || 40;
    
    return {
      totalAllocated,
      weeklyCapacity,
      percentage: (totalAllocated / weeklyCapacity) * 100
    };
  };

  /**
   * Format date header
   */
  const formatDateHeader = (date) => {
    const options = viewMode === 'day' 
      ? { weekday: 'long', month: 'short', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' };
    
    return date.toLocaleDateString('en-US', options);
  };

  /**
   * Check if date is today
   */
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /**
   * Handle assignment click
   */
  const handleAssignmentClick = (assignment) => {
    // TODO: Open assignment details modal
    console.log('Assignment clicked:', assignment);
  };

  const dateRange = useMemo(() => getDateRange(), [selectedDate, viewMode]);

  // If no users, show empty state
  if (users.length === 0) {
    return (
      <div className="workload-grid-empty">
        <div className="empty-state">
          <p className="empty-icon">👥</p>
          <h3>No Users Found</h3>
          <p>Add users to start managing workload</p>
          <button className="btn-primary" onClick={() => {/* TODO: Open add user modal */}}>
            Add User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workload-grid-container">
      <div className="workload-grid">
        {/* Header Row */}
        <div className="grid-header">
          <div className="grid-header-cell user-column">
            <span>User</span>
          </div>
          
          {dateRange.map((date, index) => (
            <div 
              key={index}
              className={`grid-header-cell date-column ${isToday(date) ? 'today' : ''}`}
            >
              {formatDateHeader(date)}
            </div>
          ))}
          
          <div className="grid-header-cell capacity-column">
            <span>Capacity</span>
          </div>
        </div>

        {/* User Rows */}
        <div className="grid-body">
          {users.map(user => {
            const isOnline = onlineUsers.has(user.id);
            const capacity = calculateUserCapacity(user.id);
            const userAssignments = assignments.filter(a => a.userId === user.id);
            
            return (
              <UserWorkloadRow
                key={user.id}
                user={user}
                isOnline={isOnline}
                dateRange={dateRange}
                assignments={userAssignments}
                capacity={capacity}
                onAssignmentClick={handleAssignmentClick}
                onUpdateAssignment={onUpdateAssignment}
                onDeleteAssignment={onDeleteAssignment}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkloadGrid;

