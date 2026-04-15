import React from 'react';
import featureFlagService from '../services/FeatureFlagService';

function Sidebar({ currentView, onViewChange, projectCount, isCollapsed = false, onToggleCollapse }) {
  const allMenuItems = [
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
      description: 'Team workload',
      featureFlag: 'workload-dashboard'
    },
    {
      id: 'agile-monitor',
      label: 'Agile Workqueue',
      icon: '📥',
      description: 'Monitor Agile queue',
      featureFlag: 'agile-workqueue'
    },
    {
      id: 'agencies',
      label: 'Agency Directory',
      icon: '📋',
      description: 'Search agencies'
    },
    {
      id: 'das-general',
      label: 'DAS General',
      icon: '📖',
      description: 'Team & product info'
    },
    { id: 'divider-tools', divider: true, label: 'Tools' },
    {
      id: 'spec-review',
      label: 'Spec Review',
      icon: '🔍',
      description: 'Analyze project specs'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure options'
    }
  ];

  // Filter menu items based on feature flags
  const menuItems = allMenuItems.filter(item => {
    if (item.featureFlag) {
      return featureFlagService.isEnabled(item.featureFlag);
    }
    return true;
  });

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-72'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg transition-all duration-300`}>
      {/* Sidebar Header */}
      <div className={`border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'px-3 py-4' : 'px-6 py-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
          {!isCollapsed && (
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Navigation
            </h3>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? '☰' : '⇤'}
          </button>
        </div>
      </div>
      
      {/* Navigation Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          if (item.divider) {
            return (
              <div key={item.id} className={`${isCollapsed ? 'px-3 pt-5 pb-2' : 'px-6 pt-5 pb-2'}`}>
                {!isCollapsed && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {item.label}
                  </span>
                )}
                <div className={`${isCollapsed ? '' : 'mt-1 '}border-b border-gray-200 dark:border-gray-700`} />
              </div>
            );
          }

          return (
            <button
              key={item.id}
              title={item.label}
              className={`
                w-full ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-6 py-4'} flex items-center ${isCollapsed ? '' : 'gap-4'} 
                border-none bg-transparent text-left
                transition-all duration-200 cursor-pointer
                relative
                ${currentView === item.id 
                  ? 'bg-gray-100 dark:bg-gray-700 border-r-4 border-primary-500' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
              onClick={() => onViewChange(item.id)}
            >
              {currentView === item.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r" />
              )}
              
              <span className={`
                text-2xl w-8 text-center flex-shrink-0
                transition-transform duration-200
                ${currentView === item.id ? 'scale-110' : 'hover:scale-110'}
              `}>
                {item.icon}
              </span>
              
              {!isCollapsed && (
                <div className="flex flex-col items-start flex-1">
                  <span className={`
                    text-sm font-medium leading-tight
                    ${currentView === item.id 
                      ? 'text-active font-semibold' 
                      : 'text-gray-800 dark:text-gray-200'
                    }
                  `}>
                    {item.label}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-tight">
                    {item.description}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
