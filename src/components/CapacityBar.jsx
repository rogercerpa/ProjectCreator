/**
 * CapacityBar - Visual indicator of user capacity
 */

import React from 'react';
import './CapacityBar.css';

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
    <div className="capacity-bar-container">
      <div className="capacity-info">
        <span className="capacity-label">{Math.round(percentage)}%</span>
        <span className="capacity-status" style={{ color: capacityColor }}>
          {capacityStatus}
        </span>
      </div>
      
      <div className="capacity-bar">
        <div
          className="capacity-fill"
          style={{
            width: `${cappedPercentage}%`,
            backgroundColor: capacityColor
          }}
        />
      </div>
      
      <div className="capacity-hours">
        {allocated.toFixed(1)}h / {total}h
      </div>
    </div>
  );
};

export default CapacityBar;

