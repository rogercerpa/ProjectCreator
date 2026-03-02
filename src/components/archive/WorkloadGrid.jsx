/**
 * WorkloadGrid - Main grid displaying users and their assignments
 */

import React, { useState, useMemo } from 'react';
import UserWorkloadRow from './UserWorkloadRow';

const WorkloadGrid = ({
  users,
  assignments,
  viewMode,
  selectedDate,
  onlineUsers,
  onAssignmentClick,
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
    // Pass to parent handler if provided
    if (onAssignmentClick) {
      onAssignmentClick(assignment);
    } else {
      console.log('Assignment clicked:', assignment);
    }
  };

  const dateRange = useMemo(() => getDateRange(), [selectedDate, viewMode]);

  // If no users, show empty state
  if (users.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="text-center p-16 max-w-md">
          <div className="text-6xl mb-5">👥</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Users Found</h3>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-8">Add users to start managing workload</p>
          <button 
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition-all"
            onClick={() => {/* TODO: Open add user modal */}}
          >
            Add User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
      <div className="flex flex-col h-full">
        {/* Header Row */}
        <div className="grid gap-0 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600 sticky top-0 z-10" style={{
          gridTemplateColumns: `200px repeat(${dateRange.length}, minmax(120px, 1fr)) 120px`
        }}>
          <div className="px-4 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-r border-gray-300 dark:border-gray-600 flex items-center">
            <span>User</span>
          </div>
          
          {dateRange.map((date, index) => (
            <div 
              key={index}
              className={`px-2 py-4 text-xs font-bold uppercase tracking-wide border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center ${
                isToday(date) 
                  ? 'bg-blue-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {formatDateHeader(date)}
            </div>
          ))}
          
          <div className="px-2 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center justify-center text-center">
            <span>Capacity</span>
          </div>
        </div>

        {/* User Rows */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
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
