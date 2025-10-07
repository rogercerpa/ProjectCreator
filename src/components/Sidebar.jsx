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
      id: 'wizard',
      label: 'Project Wizard',
      icon: '🧙‍♂️',
      description: 'Guided setup'
    },
    {
      id: 'list',
      label: 'Projects',
      icon: '📁',
      description: `View projects (${projectCount})`
    },
    {
      id: 'workload',
      label: 'Workload Dashboard',
      icon: '📊',
      description: 'Team workload'
    },
    {
      id: 'agencies',
      label: 'Agency Directory',
      icon: '📋',
      description: 'Search agencies'
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

    </aside>
  );
}

export default Sidebar;
