/**
 * UserPresenceIndicator - Shows online/offline status
 */

import React from 'react';
import './UserPresenceIndicator.css';

const UserPresenceIndicator = ({ isOnline, size = 'medium' }) => {
  return (
    <div
      className={`presence-indicator ${isOnline ? 'online' : 'offline'} ${size}`}
      title={isOnline ? 'Online' : 'Offline'}
    >
      <span className="presence-dot"></span>
    </div>
  );
};

export default UserPresenceIndicator;

