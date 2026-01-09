import React from 'react';

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
      id: 'das-general',
      label: 'DAS General',
      icon: '📖',
      description: 'Team & product info'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure options'
    }
  ];

  return (
    <aside className="w-70 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-lg">
      {/* Sidebar Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Navigation
        </h3>
      </div>
      
      {/* Navigation Menu */}
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`
              w-full px-6 py-4 flex items-center gap-4 
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
            {/* Active indicator */}
            {currentView === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r" />
            )}
            
            {/* Icon */}
            <span className={`
              text-2xl w-8 text-center flex-shrink-0
              transition-transform duration-200
              ${currentView === item.id ? 'scale-110' : 'hover:scale-110'}
            `}>
              {item.icon}
            </span>
            
            {/* Label and Description */}
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
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
