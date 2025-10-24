/**
 * WorkloadDashboard - Main workload management interface
 * Displays team workload, assignments, and capacity in real-time
 */

import React, { useState, useEffect, useCallback } from 'react';
import WorkloadGrid from './WorkloadGrid';
import WorkloadFilters from './WorkloadFilters';
import NotificationToast from './NotificationToast';
import UserPresenceIndicator from './UserPresenceIndicator';
import AssignmentDialog from './AssignmentDialog';

const WorkloadDashboard = ({ onNavigateToProject }) => {
  // State management
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // View settings
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState({
    teamFilter: 'all',
    statusFilter: 'all',
    searchTerm: '',
    userFilter: 'all' // 'all' or specific user ID
  });
  
  // Assignment Dialog
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  
  // Statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeAssignments: 0,
    overdueAssignments: 0,
    averageCapacity: 0
  });

  /**
   * Initialize dashboard - load data and setup connections
   */
  useEffect(() => {
    initializeDashboard();
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  /**
   * Initialize dashboard data and connections
   */
  const initializeDashboard = async () => {
    try {
      setIsLoading(true);
      const startTime = Date.now();
      const minLoadingDuration = 600; // Minimum 600ms to prevent flicker
      
      // Initialize current user first
      await initializeCurrentUser();
      
      // Load initial data
      await Promise.all([
        loadUsers(),
        loadProjects(),
        loadAssignments(),
        loadWorkloads(),
        loadStats()
      ]);
      
      // Setup file watcher
      await setupFileWatcher();
      
      // Setup WebSocket connection
      await setupWebSocket();
      
      // Ensure minimum loading duration for smooth UX
      const elapsedTime = Date.now() - startTime;
      const remainingTime = minLoadingDuration - elapsedTime;
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      setError('Failed to initialize dashboard: ' + error.message);
      setIsLoading(false);
    }
  };

  /**
   * Initialize current user from settings
   */
  const initializeCurrentUser = async () => {
    try {
      // Load settings to get user profile
      const settingsResult = await window.electronAPI.settingsLoad();
      
      if (settingsResult.success && settingsResult.data?.workloadSettings) {
        const { userName, userEmail, weeklyCapacity } = settingsResult.data.workloadSettings;
        
        if (userName && userEmail) {
          // Load or create user profile
          const usersResult = await window.electronAPI.workloadUsersLoadAll();
          
          if (usersResult.success) {
            let user = usersResult.users?.find(u => u.email === userEmail);
            
            if (!user) {
              // Create new user
              user = {
                id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: userName,
                email: userEmail,
                role: 'Designer',
                weeklyCapacity: weeklyCapacity || 40,
                isActive: true,
                availability: {},
                preferences: {
                  notifications: settingsResult.data.workloadSettings.showNotifications !== false,
                  onlyMyAssignments: settingsResult.data.workloadSettings.onlyMyAssignments === true,
                  emailNotifications: false
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  lastModified: new Date().toISOString(),
                  lastSeen: new Date().toISOString(),
                  status: 'online'
                }
              };
              
              await window.electronAPI.workloadUserSave(user);
            } else {
              // Update last seen
              user.metadata.lastSeen = new Date().toISOString();
              user.metadata.status = 'online';
              await window.electronAPI.workloadUserSave(user);
            }
            
            setCurrentUser(user);
            localStorage.setItem('workload-current-user', JSON.stringify(user));
          }
        }
      }
    } catch (error) {
      console.error('Error initializing current user:', error);
    }
  };

  /**
   * Load projects from persistence
   */
  const loadProjects = async () => {
    try {
      if (window.electronAPI && window.electronAPI.projectsLoadAll) {
        const result = await window.electronAPI.projectsLoadAll();
        if (result.success) {
          setProjects(result.projects || []);
        } else {
          console.error('Failed to load projects:', result.error);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  /**
   * Load users from persistence
   */
  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.workloadUsersLoadAll();
      if (result.success) {
        setUsers(result.users || []);
      } else {
        console.error('Failed to load users:', result.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  /**
   * Load assignments from persistence
   */
  const loadAssignments = async () => {
    try {
      const result = await window.electronAPI.workloadAssignmentsLoadAll();
      if (result.success) {
        setAssignments(result.assignments || []);
      } else {
        console.error('Failed to load assignments:', result.error);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  /**
   * Load workloads from persistence
   */
  const loadWorkloads = async () => {
    try {
      const result = await window.electronAPI.workloadLoadAll();
      if (result.success) {
        setWorkloads(result.workloads || []);
      } else {
        console.error('Failed to load workloads:', result.error);
      }
    } catch (error) {
      console.error('Error loading workloads:', error);
    }
  };

  /**
   * Load statistics
   */
  const loadStats = async () => {
    try {
      const result = await window.electronAPI.workloadStats();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  /**
   * Setup file watcher for shared folder changes
   */
  const setupFileWatcher = async () => {
    try {
      // Check if file watcher is already running
      const statusResult = await window.electronAPI.workloadFileWatcherStatus();
      
      if (!statusResult.status?.isWatching) {
        // Get configured data directory or use default
        const configResult = await window.electronAPI.workloadConfigLoad();
        const dataDirectory = configResult.config?.dataDirectory;
        
        if (dataDirectory) {
          await window.electronAPI.workloadFileWatcherStart(dataDirectory);
        }
      }

      // Setup file change listeners
      window.electronAPI.onWorkloadFileChanged((data) => {
        console.log('Workload file changed:', data);
        loadWorkloads();
        showNotification('Workload data updated by another user', 'info');
      });

      window.electronAPI.onWorkloadUsersFileChanged((data) => {
        console.log('Users file changed:', data);
        loadUsers();
        showNotification('User list updated', 'info');
      });

      window.electronAPI.onWorkloadAssignmentsFileChanged((data) => {
        console.log('Assignments file changed:', data);
        loadAssignments();
        loadStats();
        showNotification('Assignments updated', 'info');
      });
    } catch (error) {
      console.error('Error setting up file watcher:', error);
    }
  };

  /**
   * Setup WebSocket connection for real-time updates
   */
  const setupWebSocket = async () => {
    console.log('🚀 setupWebSocket called!');
    try {
      // Get main app settings (where WebSocket URL is stored)
      console.log('📞 Loading main app settings...');
      const settingsResult = await window.electronAPI.settingsLoad();
      const settings = settingsResult.data || settingsResult.settings || settingsResult;
      console.log('📦 Settings loaded:', settings);
      console.log('📦 Full settingsResult:', settingsResult);
      
      // Check if real-time sync is enabled
      const workloadConfig = await window.electronAPI.workloadConfigLoad();
      if (!workloadConfig?.config?.settings?.enableRealTimeSync) {
        console.log('⚠️ Real-time sync is DISABLED in workload config');
        return;
      }
      
      console.log('✅ Real-time sync is ENABLED');

      // Get current user info (from settings or create default)
      const currentUser = getCurrentUser();
      
      // Get WebSocket URL from main settings (where it's actually saved!)
      const serverUrl = settings?.workloadSettings?.websocketServer || 
                        'wss://projectcreatorv5.fly.dev';
      
      console.log('🔌 Attempting WebSocket connection to:', serverUrl);
      console.log('📋 Settings structure:', {
        hasWorkloadSettings: !!settings.workloadSettings,
        websocketServer: settings.workloadSettings?.websocketServer
      });
      
      // Connect to WebSocket server
      await window.electronAPI.websocketConnect(
        serverUrl,
        currentUser.id,
        currentUser.name
      );

      // Setup WebSocket event listeners
      window.electronAPI.onWebSocketConnected((data) => {
        console.log('✅ Connected to WebSocket server');
        setIsConnected(true);
        showNotification('Connected to real-time server', 'success');
      });

      window.electronAPI.onWebSocketDisconnected((data) => {
        console.log('🔌 Disconnected from WebSocket server');
        setIsConnected(false);
        showNotification('Disconnected from real-time server', 'warning');
      });

      window.electronAPI.onWebSocketUserPresence((data) => {
        console.log('User presence update:', data);
        handleUserPresenceUpdate(data);
      });

      window.electronAPI.onWebSocketProjectAssigned((data) => {
        console.log('Project assigned:', data);
        handleProjectAssigned(data);
      });

      window.electronAPI.onWebSocketProjectStatus((data) => {
        console.log('Project status changed:', data);
        handleProjectStatusChanged(data);
      });

      window.electronAPI.onWebSocketWorkloadUpdated((data) => {
        console.log('Workload updated:', data);
        loadWorkloads();
      });

      window.electronAPI.onWebSocketAssignmentChanged((data) => {
        console.log('Assignment changed:', data);
        loadAssignments();
        loadStats();
      });

    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }
  };

  /**
   * Get current user info
   */
  const getCurrentUser = () => {
    if (currentUser) {
      return currentUser;
    }
    
    // Try to get from localStorage
    const savedUser = localStorage.getItem('workload-current-user');
    if (savedUser) {
      return JSON.parse(savedUser);
    }
    
    // Return null - user needs to configure profile in settings
    return null;
  };

  /**
   * Handle user presence update
   */
  const handleUserPresenceUpdate = (data) => {
    setOnlineUsers(prevUsers => {
      const newUsers = new Set(prevUsers);
      if (data.status === 'online') {
        newUsers.add(data.userId);
      } else if (data.status === 'offline') {
        newUsers.delete(data.userId);
      }
      return newUsers;
    });
  };

  /**
   * Handle project assignment notification
   */
  const handleProjectAssigned = (data) => {
    const currentUser = getCurrentUser();
    
    // Check if assigned to current user
    if (data.userId === currentUser.id) {
      showNotification(
        `New Assignment: ${data.projectName || data.projectId}`,
        'assignment',
        {
          action: 'View',
          onAction: () => {
            // TODO: Navigate to project details
            console.log('View project:', data.projectId);
          }
        }
      );
    }
    
    // Reload assignments
    loadAssignments();
    loadStats();
  };

  /**
   * Handle project status change
   */
  const handleProjectStatusChanged = (data) => {
    // Just reload assignments - no popup notification
    loadAssignments();
  };

  /**
   * Show notification toast
   */
  const showNotification = (message, type = 'info', options = {}) => {
    setNotification({
      id: Date.now(),
      message,
      type,
      ...options
    });
  };

  /**
   * Clear notification
   */
  const clearNotification = () => {
    setNotification(null);
  };

  /**
   * Handle assignment creation
   */
  const handleCreateAssignment = async (assignmentData) => {
    try {
      const result = await window.electronAPI.workloadAssignmentSave(assignmentData);
      
      if (result.success) {
        await loadAssignments();
        await loadStats();
        showNotification('Assignment created successfully', 'success');
        
        // Broadcast via WebSocket if connected
        if (isConnected) {
          await window.electronAPI.websocketBroadcastAssignment(assignmentData);
        }
      } else {
        showNotification('Failed to create assignment: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      showNotification('Error creating assignment', 'error');
    }
  };

  /**
   * Handle assignment update
   */
  const handleUpdateAssignment = async (assignmentId, updates) => {
    try {
      // Find existing assignment
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        showNotification('Assignment not found', 'error');
        return;
      }

      // Merge updates
      const updatedAssignment = { ...assignment, ...updates };
      
      const result = await window.electronAPI.workloadAssignmentSave(updatedAssignment);
      
      if (result.success) {
        await loadAssignments();
        await loadStats();
        
        // Broadcast status change if status was updated
        if (updates.status && updates.status !== assignment.status && isConnected) {
          await window.electronAPI.websocketBroadcastStatus(
            assignment.projectId,
            assignment.status,
            updates.status
          );
        }
      } else {
        showNotification('Failed to update assignment: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      showNotification('Error updating assignment', 'error');
    }
  };

  /**
   * Handle assignment deletion
   */
  const handleDeleteAssignment = async (assignmentId) => {
    try {
      const result = await window.electronAPI.workloadAssignmentDelete(assignmentId);
      
      if (result.success) {
        await loadAssignments();
        await loadStats();
        showNotification('Assignment deleted', 'success');
      } else {
        showNotification('Failed to delete assignment: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      showNotification('Error deleting assignment', 'error');
    }
  };

  /**
   * Handle filter changes
   */
  const handleFilterChange = (newFilters) => {
    setFilters(prevFilters => ({ ...prevFilters, ...newFilters }));
  };

  /**
   * Apply filters to users
   */
  const getFilteredUsers = () => {
    let filtered = [...users];

    // Apply user filter (show only selected user)
    if (filters.userFilter && filters.userFilter !== 'all') {
      filtered = filtered.filter(u => u.id === filters.userFilter);
    }

    // Apply team filter
    if (filters.teamFilter !== 'all') {
      filtered = filtered.filter(u => u.role === filters.teamFilter);
    }

    // Apply search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }

    // Only show active users
    filtered = filtered.filter(u => u.isActive);

    return filtered;
  };

  /**
   * Cleanup on unmount
   */
  const cleanup = async () => {
    try {
      // Disconnect WebSocket
      if (isConnected) {
        await window.electronAPI.websocketDisconnect();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  /**
   * Refresh all data
   */
  const handleRefresh = async () => {
    try {
      await Promise.all([
        loadUsers(),
        loadProjects(),
        loadAssignments(),
        loadWorkloads(),
        loadStats()
      ]);
      showNotification('Data refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showNotification('Error refreshing data', 'error');
    }
  };

  /**
   * Open assignment dialog for creating new assignment
   */
  const handleOpenAssignmentDialog = () => {
    setEditingAssignment(null);
    setShowAssignmentDialog(true);
  };

  /**
   * Open assignment dialog for editing existing assignment
   */
  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setShowAssignmentDialog(true);
  };

  /**
   * Close assignment dialog
   */
  const handleCloseAssignmentDialog = () => {
    setShowAssignmentDialog(false);
    setEditingAssignment(null);
  };

  /**
   * Handle assignment form submission
   */
  const handleAssignmentSubmit = async (assignmentData) => {
    try {
      // Add assigned by info
      const currentUserInfo = getCurrentUser();
      if (currentUserInfo) {
        assignmentData.assignedBy = currentUserInfo.id;
      }

      if (editingAssignment) {
        // Update existing assignment
        await handleUpdateAssignment(editingAssignment.id, assignmentData);
      } else {
        // Create new assignment
        await handleCreateAssignment(assignmentData);
      }

      handleCloseAssignmentDialog();
    } catch (error) {
      console.error('Error submitting assignment:', error);
      throw error; // Let dialog handle the error
    }
  };

  /**
   * Handle assignment card click - Navigate to project
   */
  const handleAssignmentCardClick = async (assignment) => {
    try {
      console.log('Assignment clicked:', assignment);
      
      if (!assignment.projectId) {
        showNotification('Project ID not found', 'error');
        return;
      }

      // Find the project in loaded projects
      let project = projects.find(p => p.id === assignment.projectId);
      
      // If not found in loaded projects, try to load it
      if (!project) {
        console.log('Project not in loaded list, fetching...');
        const result = await window.electronAPI.projectsLoadAll();
        if (result.success) {
          project = result.projects.find(p => p.id === assignment.projectId);
        }
      }

      if (!project) {
        showNotification('Project not found', 'error');
        return;
      }

      // Navigate to project management view
      if (onNavigateToProject) {
        onNavigateToProject(project);
      } else {
        console.warn('onNavigateToProject prop not provided');
        showNotification('Navigation not configured', 'warning');
      }
    } catch (error) {
      console.error('Error navigating to project:', error);
      showNotification('Failed to open project', 'error');
    }
  };

  // Render error state
  if (error) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-5">
        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-error-600 dark:text-error-400 mb-3">Error Loading Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{error}</p>
          <button 
            onClick={initializeDashboard} 
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition-all"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();
  const onlineCount = onlineUsers.size;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-4 overflow-hidden">
      <div className="relative flex-1 flex flex-col animate-fadeIn">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="flex flex-col items-center gap-5 p-10 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
              <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400 text-base font-medium">Loading workload dashboard...</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📊 Workload Dashboard
            </h1>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              <span className={`text-base ${isConnected ? 'animate-pulse' : ''}`}>
                {isConnected ? '🟢' : '🔴'}
              </span>
              <span>
                {isConnected ? `Live | ${onlineCount} users online` : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleOpenAssignmentDialog} 
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
              title="Assign Project"
            >
              ➕ Assign Project
            </button>
            <button 
              onClick={handleRefresh} 
              className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-lg transition-all"
              title="Refresh data"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Statistics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all cursor-default">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.totalUsers || users.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
              Total Users
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all cursor-default">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.activeAssignments || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
              Active Assignments
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all cursor-default">
            <div className="text-3xl font-bold text-error-600 dark:text-error-400 mb-1">
              {stats.overdueAssignments || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
              Overdue
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all cursor-default">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {stats.averageCapacity ? `${Math.round(stats.averageCapacity)}%` : '0%'}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
              Avg Capacity
            </div>
          </div>
        </div>

        {/* Filters */}
        <WorkloadFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          users={users}
        />

        {/* Main Grid */}
        <WorkloadGrid
          users={filteredUsers}
          assignments={assignments}
          viewMode={viewMode}
          selectedDate={selectedDate}
          onlineUsers={onlineUsers}
          onAssignmentClick={handleAssignmentCardClick}
          onCreateAssignment={handleCreateAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          onDeleteAssignment={handleDeleteAssignment}
        />

        {/* Assignment Dialog */}
        <AssignmentDialog
          isOpen={showAssignmentDialog}
          onClose={handleCloseAssignmentDialog}
          onAssign={handleAssignmentSubmit}
          users={users}
          projects={projects}
          editAssignment={editingAssignment}
        />

        {/* Notification Toast */}
        {notification && (
          <NotificationToast
            notification={notification}
            onClose={clearNotification}
          />
        )}
      </div>
    </div>
  );
};

export default WorkloadDashboard;

