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
import './WorkloadDashboard.css';

const WorkloadDashboard = () => {
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
    try {
      // Get WebSocket configuration
      const configResult = await window.electronAPI.workloadConfigLoad();
      const config = configResult.config;
      
      if (!config?.settings?.enableRealTimeSync) {
        console.log('Real-time sync is disabled');
        return;
      }

      // Get current user info (from settings or create default)
      const currentUser = getCurrentUser();
      const serverUrl = config.websocketServer || 'ws://localhost:8080';
      
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

  // Render loading state
  if (isLoading) {
    return (
      <div className="workload-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading workload dashboard...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="workload-dashboard">
        <div className="error-container">
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={initializeDashboard} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();
  const onlineCount = onlineUsers.size;

  return (
    <div className="workload-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>📊 Workload Dashboard</h1>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? '🟢' : '🔴'}
            </span>
            <span className="status-text">
              {isConnected ? `Live | ${onlineCount} users online` : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            onClick={handleOpenAssignmentDialog} 
            className="btn-icon"
            title="Assign Project"
            style={{ 
              background: '#3498db', 
              color: 'white',
              width: 'auto',
              padding: '0 16px',
              gap: '8px'
            }}
          >
            ➕ Assign Project
          </button>
          <button 
            onClick={handleRefresh} 
            className="btn-icon"
            title="Refresh data"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-value">{stats.totalUsers || users.length}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activeAssignments || 0}</span>
          <span className="stat-label">Active Assignments</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.overdueAssignments || 0}</span>
          <span className="stat-label">Overdue</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {stats.averageCapacity ? `${Math.round(stats.averageCapacity)}%` : '0%'}
          </span>
          <span className="stat-label">Avg Capacity</span>
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
  );
};

export default WorkloadDashboard;

