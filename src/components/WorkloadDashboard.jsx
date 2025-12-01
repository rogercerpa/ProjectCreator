/**
 * WorkloadDashboard - MS 365 Integration Dashboard
 * Summary dashboard with MS Lists integration
 */

import React, { useState, useEffect } from 'react';
import NotificationToast from './NotificationToast';

const WorkloadDashboard = ({ onNavigateToProject }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeAssignments: 0,
    teamMembers: 0,
    capacityUtilization: 0
  });
  const [excelSettings, setExcelSettings] = useState({
    enabled: false,
    filePath: '',
    msListsUrl: '',
    lastSync: null,
    lastExport: null
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    try {
      setIsLoading(true);
      
      // Load stats
      await loadStats();
      
      // Load Excel settings
      await loadExcelSettings();
      
      // Load recent activity
      await loadRecentActivity();
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Load projects
      const projectsResult = await window.electronAPI.projectsLoadAll();
      const projects = projectsResult.success ? projectsResult.projects : [];
      
      // Load assignments
      const assignmentsResult = await window.electronAPI.workloadAssignmentsLoadAll();
      const assignments = assignmentsResult.success ? assignmentsResult.assignments : [];
      
      // Load users
      const usersResult = await window.electronAPI.workloadUsersLoadAll();
      const users = usersResult.success ? usersResult.users : [];
      
      setStats({
        totalProjects: projects.length,
        activeAssignments: assignments.filter(a => a.status !== 'completed').length,
        teamMembers: users.length,
        capacityUtilization: calculateAverageCapacity(users, assignments)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const calculateAverageCapacity = (users, assignments) => {
    if (users.length === 0) return 0;
    
    const totalCapacity = users.reduce((sum, user) => {
      const userAssignments = assignments.filter(a => a.userId === user.id && a.status !== 'completed');
      const hoursAllocated = userAssignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
      const weeklyCapacity = user.weeklyCapacity || 40;
      return sum + (hoursAllocated / weeklyCapacity);
    }, 0);
    
    return Math.round((totalCapacity / users.length) * 100);
  };

  const loadExcelSettings = async () => {
    try {
      if (window.electronAPI?.workloadExcelSyncSettingsGet) {
        const result = await window.electronAPI.workloadExcelSyncSettingsGet();
        if (result.success) {
          setExcelSettings(result.settings);
        }
      }
    } catch (error) {
      console.error('Error loading Excel settings:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const assignmentsResult = await window.electronAPI.workloadAssignmentsLoadAll();
      if (assignmentsResult.success) {
        const sorted = assignmentsResult.assignments
          .sort((a, b) => new Date(b.lastModified || b.createdDate) - new Date(a.lastModified || a.createdDate))
          .slice(0, 10);
        setRecentActivity(sorted);
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const handleOpenMSLists = () => {
    if (excelSettings.msListsUrl) {
      window.electronAPI?.openExternal(excelSettings.msListsUrl);
    } else {
      showNotification('error', 'MS Lists URL not configured. Please set it in Settings → Workload.');
    }
  };

  const handleSyncNow = async () => {
    try {
      if (!excelSettings.filePath) {
        showNotification('error', 'Excel file path not configured. Please set it in Settings → Workload.');
        return;
      }

      setSyncStatus({ type: 'loading', message: 'Syncing from Excel...' });
      const result = await window.electronAPI.workloadExcelSyncFromExcel(excelSettings.filePath);
      
      if (result.success) {
        setSyncStatus({ 
          type: 'success', 
          message: `Synced: ${result.data.projects.length} projects, ${result.data.assignments.length} assignments`
        });
        await loadStats();
        await loadRecentActivity();
        await loadExcelSettings();
      } else {
        setSyncStatus({ type: 'error', message: result.error || 'Sync failed' });
      }
      
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const handleExportToExcel = async () => {
    try {
      if (!excelSettings.filePath) {
        showNotification('error', 'Excel file path not configured. Please set it in Settings → Workload.');
        return;
      }

      setSyncStatus({ type: 'loading', message: 'Exporting to Excel...' });
      
      const projects = await window.electronAPI.projectsLoadAll();
      const assignments = await window.electronAPI.workloadAssignmentsLoadAll();
      const users = await window.electronAPI.workloadUsersLoadAll();
      
      const data = {
        projects: projects.success ? projects.projects : [],
        assignments: assignments.success ? assignments.assignments : [],
        users: users.success ? users.users : []
      };
      
      const result = await window.electronAPI.workloadExcelExportAll(data, excelSettings.filePath);
      
      if (result.success) {
        setSyncStatus({ 
          type: 'success', 
          message: `Exported: ${result.results.projects} projects, ${result.results.assignments} assignments`
        });
        await loadExcelSettings();
      } else {
        setSyncStatus({ type: 'error', message: result.error || 'Export failed' });
      }
      
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (error) {
      console.error('Error exporting:', error);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message, id: Date.now() });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading workload dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Workload Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Powered by Microsoft Lists</p>
          </div>
          <button
            onClick={handleOpenMSLists}
            disabled={!excelSettings.msListsUrl}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
          >
            <span>📋</span>
            <span>Open in MS Lists</span>
          </button>
        </div>

        {!excelSettings.enabled && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Excel Sync Not Enabled:</strong> Enable MS 365 Excel Integration in Settings → Workload to use this feature.
            </p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Projects</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalProjects}</p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Assignments</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.activeAssignments}</p>
            </div>
            <div className="text-4xl">📋</div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Team Members</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.teamMembers}</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Capacity</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.capacityUtilization}%</p>
            </div>
            <div className="text-4xl">⚡</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">No recent assignments</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map(assignment => (
                  <div key={assignment.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {assignment.projectName || assignment.projectNumber || 'Project'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {assignment.userName} • {assignment.status}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        assignment.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        assignment.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                        assignment.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      }`}>
                        {assignment.priority || 'normal'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sync Status & Actions */}
        <div className="space-y-6">
          {/* Sync Status */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sync Status</h2>
            
            <div className="space-y-3">
              {excelSettings.lastSync && (
                <div className="text-sm">
                  <p className="text-gray-600 dark:text-gray-400">Last Import:</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(excelSettings.lastSync).toLocaleString()}
                  </p>
                </div>
              )}
              
              {excelSettings.lastExport && (
                <div className="text-sm">
                  <p className="text-gray-600 dark:text-gray-400">Last Export:</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(excelSettings.lastExport).toLocaleString()}
                  </p>
                </div>
              )}

              {syncStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  syncStatus.type === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                  syncStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                  'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                }`}>
                  {syncStatus.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
                  {syncStatus.message}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleSyncNow}
                disabled={!excelSettings.enabled || !excelSettings.filePath}
                className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                🔄 Sync Now
              </button>
              
              <button
                onClick={handleExportToExcel}
                disabled={!excelSettings.enabled || !excelSettings.filePath}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                📤 Export to Excel
              </button>
              
              <button
                onClick={() => window.location.hash = '#/settings'}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
              >
                ⚙️ Configure Settings
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2">💡 How It Works</h3>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Create projects in this app</li>
              <li>• Export to Excel</li>
              <li>• Excel syncs to MS Lists (Power Automate)</li>
              <li>• Engineers manage work in MS Lists</li>
              <li>• Sync back to app when needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <NotificationToast
          notification={notification}
          onClose={clearNotification}
        />
      )}
    </div>
  );
};

export default WorkloadDashboard;
