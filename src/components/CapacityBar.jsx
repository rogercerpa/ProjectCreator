/**
 * CapacityBar - Visual indicator of user capacity
 */

import React from 'react';

const CapacityBar = ({ percentage, allocated, total }) => {
  
  /**
   * Get capacity color based on percentage
   */
  const getCapacityColor = () => {
    if (percentage >= 100) return '#e74c3c'; // Red - over capacity
    if (percentage >= 80) return '#f39c12';  // Orange - near capacity
    if (percentage >= 60) return '#3498db';  // Blue - good utilization
    return '#27ae60'; // Green - under-utilized
  };

  /**
   * Get capacity status text
   */
  const getCapacityStatus = () => {
    if (percentage >= 100) return 'Over Capacity';
    if (percentage >= 80) return 'At Capacity';
    if (percentage >= 60) return 'Good';
    return 'Available';
  };

  const cappedPercentage = Math.min(100, percentage);
  const capacityColor = getCapacityColor();
  const capacityStatus = getCapacityStatus();

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
          {Math.round(percentage)}%
        </span>
        <span 
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: capacityColor }}
        >
          {capacityStatus}
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-300 ease-out"
          style={{
            width: `${cappedPercentage}%`,
            backgroundColor: capacityColor
          }}
        />
      </div>
      
      <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
        {allocated.toFixed(1)}h / {total}h
      </div>
    </div>
  );
};

export default CapacityBar;

