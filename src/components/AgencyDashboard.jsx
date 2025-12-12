import React, { useState, useEffect } from 'react';
import AgencyOverviewTab from './agency/AgencyOverviewTab';
import AgencyProjectsTab from './agency/AgencyProjectsTab';
import AgencyContactTab from './agency/AgencyContactTab';
import AgencyNotesTab from './agency/AgencyNotesTab';
import AgencyDesignRequirementsTab from './agency/AgencyDesignRequirementsTab';
import AgencyProductFocusTab from './agency/AgencyProductFocusTab';
import AgencyTrainingTab from './agency/AgencyTrainingTab';
import AgencyEmailTemplatesTab from './agency/AgencyEmailTemplatesTab';
import AgencyMarketStrategyTab from './agency/AgencyMarketStrategyTab';
import AgencyAnalyticsTab from './agency/AgencyAnalyticsTab';
import AgencyTasksTab from './agency/AgencyTasksTab';
import AgencySettingsTab from './agency/AgencySettingsTab';

function AgencyDashboard({ agency, onBack, onProjectSelect }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Get all agents for this agency (grouped by agency name)
  const [allAgents, setAllAgents] = useState([]);

  useEffect(() => {
    if (agency) {
      loadAllAgents();
    }
  }, [agency]);

  const loadAllAgents = async () => {
    if (!agency?.agencyName) return;

    try {
      setLoading(true);
      const result = await window.electronAPI.agenciesSearch(agency.agencyName, { region: 'all', role: 'all' });
      if (result && result.success) {
        // Filter to only agents from this agency
        const agencyAgents = result.agencies.filter(a => 
          a.agencyName && a.agencyName.toLowerCase() === agency.agencyName.toLowerCase()
        );
        setAllAgents(agencyAgents);
        
        // If the current agency doesn't have an id, use the first agent's id
        if (!agency.id && agencyAgents.length > 0 && agencyAgents[0].id) {
          // Update the agency object with the id from the first agent
          // This ensures all tabs can save data properly
          Object.assign(agency, { id: agencyAgents[0].id });
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'contacts', label: 'Contacts', icon: '👥' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'design', label: 'Design Requirements', icon: '🎨' },
    { id: 'products', label: 'Product Focus', icon: '📦' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'templates', label: 'Email Templates', icon: '📧' },
    { id: 'strategy', label: 'Market Strategy', icon: '📈' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const handleQuickAction = async (action) => {
    switch (action) {
      case 'email':
        if (agency?.contactEmail) {
          const subject = `Contact: ${agency.agencyName}`;
          const mailtoUrl = `mailto:${agency.contactEmail}?subject=${encodeURIComponent(subject)}`;
          await window.electronAPI.openExternal(mailtoUrl);
        }
        break;
      case 'report':
        // TODO: Implement report generation
        console.log('Generate report for', agency?.agencyName);
        break;
      default:
        break;
    }
  };

  if (!agency) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No agency selected</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Back to Directory
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Back to Agency Directory"
              >
                ←
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {agency.agencyName}
                </h1>
                {agency.agencyNumber && (
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                    #{agency.agencyNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                {agency.region && (
                  <span className="flex items-center gap-1">
                    📍 {agency.region}
                  </span>
                )}
                {allAgents.length > 0 && (
                  <span className="flex items-center gap-1">
                    👥 {allAgents.length} {allAgents.length === 1 ? 'Agent' : 'Agents'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {agency.contactEmail && (
              <button
                onClick={() => handleQuickAction('email')}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
                title="Email Agency"
              >
                <span>✉️</span>
                <span>Email</span>
              </button>
            )}
            <button
              onClick={() => handleQuickAction('report')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
              title="Generate Report"
            >
              <span>📊</span>
              <span>Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6">
          {/* Mobile Dropdown Menu */}
          <div className="lg:hidden mb-2">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.icon} {tab.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Desktop Tab Bar */}
          <div className="hidden lg:flex gap-1 overflow-x-auto custom-scrollbar scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading agency data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <AgencyOverviewTab agency={agency} allAgents={allAgents} />
            )}
            {activeTab === 'projects' && (
              <AgencyProjectsTab 
                agency={agency}
                onProjectSelect={onProjectSelect}
              />
            )}
            {activeTab === 'contacts' && (
              <AgencyContactTab agency={agency} allAgents={allAgents} />
            )}
            {activeTab === 'notes' && (
              <AgencyNotesTab agency={agency} />
            )}
            {activeTab === 'design' && (
              <AgencyDesignRequirementsTab agency={agency} />
            )}
            {activeTab === 'products' && (
              <AgencyProductFocusTab agency={agency} />
            )}
            {activeTab === 'training' && (
              <AgencyTrainingTab agency={agency} />
            )}
            {activeTab === 'templates' && (
              <AgencyEmailTemplatesTab agency={agency} />
            )}
            {activeTab === 'strategy' && (
              <AgencyMarketStrategyTab agency={agency} />
            )}
            {activeTab === 'analytics' && (
              <AgencyAnalyticsTab agency={agency} />
            )}
            {activeTab === 'tasks' && (
              <AgencyTasksTab agency={agency} />
            )}
            {activeTab === 'settings' && (
              <AgencySettingsTab agency={agency} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AgencyDashboard;

