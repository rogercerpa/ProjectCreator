import React from 'react';
import './Sidebar.css';

function Sidebar({ currentView, onViewChange, projectCount }) {
  const menuItems = [
    {
      id: 'welcome',
      label: 'Welcome',
      icon: '🏠',
      description: 'Get started'
    },
    {
      id: 'form',
      label: 'Project Form',
      icon: '📝',
      description: 'Create projects'
    },
    {
      id: 'list',
      label: 'Projects',
      icon: '📁',
      description: `View projects (${projectCount})`
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure options'
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Navigation</h3>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <div className="sidebar-content">
              <span className="sidebar-label">{item.label}</span>
              <span className="sidebar-description">{item.description}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-info">
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className="info-value online">Online</span>
          </div>
          <div className="info-item">
            <span className="info-label">Projects:</span>
            <span className="info-value">{projectCount}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
