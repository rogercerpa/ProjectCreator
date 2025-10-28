/**
 * UserPresenceIndicator - Shows online/offline status
 */

import React from 'react';

const UserPresenceIndicator = ({ isOnline, size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-10 h-10'
  };

  const dotSizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-2.5 h-2.5',
    large: 'w-3 h-3'
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0 ${sizeClasses[size]}`}
      title={isOnline ? 'Online' : 'Offline'}
    >
      <span 
        className={`block rounded-full ${dotSizeClasses[size]} ${
          isOnline 
            ? 'bg-success-600 dark:bg-success-500 animate-pulse-soft' 
            : 'bg-gray-400 dark:bg-gray-600'
        }`}
      />
    </div>
  );
};

export default UserPresenceIndicator;

