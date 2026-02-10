import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProjectForm from './components/ProjectForm';
import ProjectWizard from './components/wizard/ProjectWizard';
import ProjectManagement from './components/ProjectManagement';
import ProjectList from './components/ProjectList';
import AgencyDirectory from './components/AgencyDirectory';
import AgencyDashboard from './components/AgencyDashboard';
import WorkloadDashboard from './components/WorkloadDashboard';
import AgileMonitorView from './components/agile/AgileMonitorView';
import DraftRecoveryModal from './components/wizard/components/DraftRecoveryModal';
import MigrationAssistant from './components/wizard/components/MigrationAssistant';
import Settings from './components/Settings';
import DASGeneralPage from './components/DASGeneralPage';
import logoUrl from '/assets/images/logo.png';
// Use simple services that work in both main and renderer processes
import featureFlagService from './services/FeatureFlagService';
import crashReportingService from './services/SimpleCrashReportingService';
import analyticsService from './services/SimpleAnalyticsService';
import performanceMonitoringService from './services/SimplePerformanceMonitoringService';
import { getFullVersionInfo, getVersionDisplay } from './utils/version';

// Import draft service for enhanced recovery
const ProjectDraftService = window.electron ? 
  window.electron.require('./src/services/ProjectDraftService') : 
  null;

const createDefaultFormData = () => ({
  projectName: '',
  rfaNumber: '',
  agentNumber: '',
  projectContainer: '',
  rfaType: '',
  regionalTeam: '',
  ecd: '',
  nationalAccount: 'Default',
  complexity: '',
  rfaValue: '',
  status: '',
  products: '',
  triagedBy: '',
  designBy: '',
  qcBy: '',
  repContacts: '',
  requestedDate: '',
  submittedDate: '',
  // New fields for reorganized form
  projectAddress: '',
  projectStage: '',
  designProcessPhase: '',
  buyAmericanOrBaba: false,
  agencyName: '',
  rfaStatus: '',
  rfaComplexity: '',
  neededByDate: '',
  bidDate: '',
  // Unified Triage Control Fields
  hasPanelSchedules: false,
  hasSubmittals: false,
  needsLayoutBOM: false,
  // Panel Schedule Fields
  largeLMPs: 0,
  mediumLMPs: 0,
  smallLMPs: 0,
  arp8: 0,
  arp16: 0,
  arp32: 0,
  arp48: 0,
  esheetsSchedules: 2,
  showPanelSchedules: false,
  // Layout Fields
  numOfRooms: 0,
  overrideRooms: 0,
  roomMultiplier: 2,
  reviewSetup: 0.5,
  numOfPages: 1,
  specReview: 0,
  // Submittal Fields
  numOfSubRooms: 0,
  overrideSubRooms: 0,
  riserMultiplier: 1,
  soo: 0.5,
  // Photometrics Fields
  photoSoftware: 'VL',
  // Triage Results
  saveLocation: 'Server',
  isRevision: false,
  dueDate: '',
  totalTriage: 0,
  panelTime: 0,
  layoutTime: 0,
  submittalTime: 0,
  pageBonus: 0,
  baseTotal: 0,
  selfQC: 0,
  fluff: 0,
  // Additional Fields
  firstAvailable: false,
  // DAS Paid Services
  dasPaidServiceEnabled: false,
  dasPaidServiceForced: false,
  dasCostOption: 'new',
  dasCostPerPage: 350,
  dasCostPerPageManual: false,
  dasLightingPages: 0,
  dasFee: 0,
  dasFeeManual: false,
  dasStatus: 'Waiting on Order',
  dasRepEmail: '',
  dasRepEmailList: []
});

function App() {
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('welcome');
  const [currentProject, setCurrentProject] = useState(null);
  const [currentAgency, setCurrentAgency] = useState(null);
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsTab, setSettingsTab] = useState('app-info');
  
  // Draft recovery state
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [draftService] = useState(() => ProjectDraftService ? new ProjectDraftService() : null);
  const [hasDrafts, setHasDrafts] = useState(false);
  
  // Migration and feature flag state
  const [showMigrationAssistant, setShowMigrationAssistant] = useState(false);
  const [userInterfacePreference, setUserInterfacePreference] = useState(null);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [formData, setFormData] = useState(() => createDefaultFormData());

  // Initialize monitoring services
  const initializeMonitoringServices = async () => {
    try {
      // Initialize crash reporting
      await crashReportingService.initialize({
        environment: typeof process !== 'undefined' ? process.env?.NODE_ENV : 'development',
        debug: typeof process !== 'undefined' ? process.env?.NODE_ENV === 'development' : true
      });

      // Initialize analytics
      analyticsService.initialize({
        enabled: true,
        version: getFullVersionInfo().full
      });

      // Initialize performance monitoring
      performanceMonitoringService.initialize({
        enabled: true,
        thresholds: {
          renderTime: 100,
          apiResponseTime: 1000,
          memoryUsage: 100 * 1024 * 1024
        }
      });

      // Track app initialization
      analyticsService.trackEvent('app_initialized', {
        version: getFullVersionInfo().full,
        platform: typeof process !== 'undefined' ? process.platform : 'unknown',
        arch: typeof process !== 'undefined' ? process.arch : 'unknown'
      });

      console.log('Monitoring services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize monitoring services:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Initialize crash reporting and analytics
        await initializeMonitoringServices();
        
        // Check if this is the user's first visit
        const hasVisitedBefore = localStorage.getItem('app-visited') === 'true';
        setIsFirstVisit(!hasVisitedBefore);
        
        if (!hasVisitedBefore) {
          localStorage.setItem('app-visited', 'true');
          localStorage.setItem('user-join-date', new Date().toISOString());
        }
        
        // Load user interface preference
        const savedPreference = localStorage.getItem('interface-preference');
        setUserInterfacePreference(savedPreference);
        
        // Load application settings
        try {
          if (window.electronAPI?.settingsLoad) {
            const settingsResult = await window.electronAPI.settingsLoad();
            if (settingsResult?.success) {
              setSettings(settingsResult.data);
              console.log('✅ Settings loaded successfully');
            }
          }
        } catch (settingsError) {
          console.warn('⚠️ Failed to load settings:', settingsError);
        }
        
        // CRITICAL FIX: Load existing projects from persistent storage
        try {
          const projectsResult = await window.electronAPI.projectsLoadAll();
          if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
            setProjects(projectsResult.projects);
            console.log(`✅ Loaded ${projectsResult.projects.length} existing projects from storage`);
            
            // Auto-scan Ready for QC folder and update project statuses
            try {
              const scanResult = await window.electronAPI.qcScanFolder();
              if (scanResult.success) {
                if (scanResult.updatedProjects && scanResult.updatedProjects.length > 0) {
                  // Update projects list with updated statuses
                  const updatedProjectsMap = new Map(scanResult.updatedProjects.map(p => [p.id, p]));
                  setProjects(prevProjects => 
                    prevProjects.map(p => {
                      const updated = updatedProjectsMap.get(p.id);
                      return updated || p;
                    })
                  );
                  console.log(`✅ Auto-scanned Ready for QC: Updated ${scanResult.updateCount} project(s) to "Ready for QC"`);
                } else if (scanResult.totalMatches > 0) {
                  console.log(`✅ Auto-scanned Ready for QC: Found ${scanResult.totalMatches} match(es), but no status updates needed`);
                }
              }
            } catch (scanError) {
              console.warn('⚠️ Auto-scan Ready for QC failed:', scanError);
              // Don't block app startup if scan fails
            }
          } else {
            console.warn('Failed to load projects:', projectsResult?.error || 'Unknown error');
            setProjects([]); // Ensure projects is always an array
          }
        } catch (projectLoadError) {
          console.error('Error loading existing projects:', projectLoadError);
          setProjects([]); // Ensure projects is always an array even on error
        }

        // Check for existing drafts
        if (draftService) {
          try {
            const allDrafts = await draftService.getAllDrafts();
            setHasDrafts(allDrafts.length > 0);
          } catch (error) {
            console.warn('Error checking drafts:', error);
          }
        }
        
        // Determine if onboarding tutorial should be shown for new users only
        const hasCompletedOnboarding = localStorage.getItem('onboarding-completed') === 'true';
        const shouldShowOnboarding = !hasVisitedBefore && !hasCompletedOnboarding;
        
        if (shouldShowOnboarding) {
          // Show onboarding tutorial after a brief delay for new users
          setTimeout(() => {
            setShowMigrationAssistant(true);
          }, 2000);
        }
        
        // Ensure form data is properly initialized with default values
        setFormData(prevFormData => ({
          ...prevFormData,
          // Ensure all numeric fields are properly initialized as numbers
          largeLMPs: 0,
          mediumLMPs: 0,
          smallLMPs: 0,
          arp8: 0,
          arp16: 0,
          arp32: 0,
          arp48: 0,
          numOfRooms: 0,
          overrideRooms: 0,
          roomMultiplier: 2,
          reviewSetup: 0.5,
          numOfPages: 1,
          specReview: 0,
          numOfSubRooms: 0,
          overrideSubRooms: 0,
          riserMultiplier: 1,
          soo: 0.5,
          totalTriage: 0,
          panelTime: 0,
          layoutTime: 0,
          submittalTime: 0,
          pageBonus: 0,
          baseTotal: 0,
          selfQC: 0,
          fluff: 0
        }));
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize app:', err);
        
        // Track error in analytics and crash reporting
        analyticsService.trackError(err, { context: 'app_initialization' });
        crashReportingService.captureException(err, { context: 'app_initialization' });
        
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [draftService]);

  // Cleanup monitoring services on unmount
  useEffect(() => {
    return () => {
      // Cleanup monitoring services
      crashReportingService.close();
      analyticsService.cleanup();
      performanceMonitoringService.cleanup();
    };
  }, []);

  const handleProjectCreated = async (project) => {
    console.log('🎯 handleProjectCreated called with:', project);
    
    // Validate project data
    if (!project) {
      console.error('❌ handleProjectCreated: No project provided!');
      throw new Error('No project provided to handleProjectCreated');
    }
    
    if (!project.id) {
      console.error('❌ handleProjectCreated: Project missing ID!', project);
      throw new Error('Project missing ID');
    }
    
    console.log('✅ handleProjectCreated: Project validation passed');
    
    // IDLE FIX: Helper to wrap promises with timeout to prevent hanging after long idle
    // Returns fallbackValue if promise doesn't resolve within timeout
    const withTimeout = (promise, ms, fallbackValue) => {
      const timeout = new Promise((resolve) => {
        setTimeout(() => {
          console.warn(`⚠️ handleProjectCreated: IPC call timed out after ${ms}ms`);
          resolve(fallbackValue);
        }, ms);
      });
      return Promise.race([promise, timeout]);
    };
    
    try {
      // IDLE FIX: Reload projects with timeout protection
      // If app was idle for 30+ minutes, IPC may be slow - use 3 second timeout
      console.log('🔄 handleProjectCreated: Reloading projects with timeout protection...');
      const projectsResult = await withTimeout(
        window.electronAPI.projectsLoadAll(),
        3000, // 3 second timeout
        null  // Return null on timeout
      );
      
      let projectToSet = project;
      let projectsList = null;
      
      if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
        console.log('✅ handleProjectCreated: Successfully reloaded projects from storage');
        console.log(`🔄 handleProjectCreated: Found ${projectsResult.projects.length} projects in storage`);
        
        projectsList = projectsResult.projects;
        
        // Find the newly created project in the fresh data
        const freshProject = projectsList.find(p => p.id === project.id);
        if (freshProject) {
          console.log('✅ handleProjectCreated: Found newly created project in fresh data');
          projectToSet = freshProject;
        } else {
          console.log('⚠️ handleProjectCreated: Using provided project data as fallback');
        }
      } else {
        // Timeout or failure - use provided project directly
        console.warn('⚠️ handleProjectCreated: Projects reload timed out or failed, using provided project');
        projectsList = null; // Will trigger fallback below
      }
      
      // Update state with flushSync for synchronous updates
      console.log('🔄 handleProjectCreated: Updating state...');
      flushSync(() => {
        if (projectsList) {
          setProjects(projectsList);
        } else {
          // Fallback: add project to existing list
          setProjects(prev => {
            const existingIndex = prev.findIndex(p => p.id === project.id);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = project;
              return updated;
            } else {
              return [project, ...prev];
            }
          });
        }
        setCurrentProject(projectToSet);
      });
      
      // Reset form data so wizard shows clean Step 1 when user returns
      console.log('🔄 handleProjectCreated: Resetting form data...');
      handleFormReset(); // Don't await - let it run async
      
      // Navigate to project management view immediately
      console.log('🎯 handleProjectCreated: Navigating to project-management');
      flushSync(() => {
        setCurrentView('project-management');
      });
      
      console.log('✅ handleProjectCreated: Navigation completed successfully');
      
    } catch (error) {
      console.error('❌ handleProjectCreated: Error during state updates:', error);
      
      // Fallback: Use provided project and navigate anyway
      console.log('🔄 handleProjectCreated: Attempting fallback navigation...');
      try {
        flushSync(() => {
          setProjects(prev => [project, ...prev]);
          setCurrentProject(project);
        });
        
        // Reset form data (don't await)
        handleFormReset();
        
        // Navigate to project management view
        flushSync(() => {
          setCurrentView('project-management');
        });
        
        console.log('✅ handleProjectCreated: Fallback navigation completed');
      } catch (fallbackError) {
        console.error('❌ handleProjectCreated: Fallback also failed:', fallbackError);
        // Still try to navigate even if fallback failed
        try {
          setCurrentProject(project);
          setCurrentView('project-management');
        } catch (e) {
          console.error('❌ handleProjectCreated: Final navigation attempt failed:', e);
        }
      }
      // Don't re-throw - navigation should have completed
    }
    
    // Track project creation in analytics (non-blocking)
    try {
      analyticsService.trackProjectCreation(project, {
        projectType: project.rfaType,
        regionalTeam: project.regionalTeam,
        complexity: project.complexity
      });
      console.log('✅ handleProjectCreated: Analytics tracked successfully');
    } catch (analyticsError) {
      console.warn('⚠️ handleProjectCreated: Analytics tracking failed:', analyticsError);
      // Don't throw - analytics failure shouldn't block navigation
    }
  };

  // Helper function to sync work task assignments when project is updated
  const syncWorkTaskAssignments = async (project) => {
    try {
      // Load existing assignments for this project
      const assignmentsResult = await window.electronAPI.workloadAssignmentsLoadAll();
      if (!assignmentsResult.success) return;
      
      const allAssignments = assignmentsResult.assignments || [];
      const projectAssignments = allAssignments.filter(a => a.projectId === project.id);
      
      // Helper to find user by name
      const findUserByName = async (userName) => {
        if (!userName) return null;
        try {
          const usersResult = await window.electronAPI.workloadUsersLoadAll();
          if (usersResult.success && usersResult.users) {
            return usersResult.users.find(u => u.name === userName) || null;
          }
        } catch (error) {
          console.error('Error finding user:', error);
        }
        return null;
      };

      // Helper to create/update assignment
      const createOrUpdateAssignment = async (user, taskType, taskName) => {
        if (!user) return null;
        
        // Check if assignment already exists for this project and task type
        const existingAssignment = projectAssignments.find(
          a => a.taskType === taskType
        );
        
        if (existingAssignment) {
          // Assignment exists, check if user changed
          if (existingAssignment.userId !== user.id) {
            // User changed, update the assignment
            const updatedAssignment = {
              ...existingAssignment,
              userId: user.id,
              metadata: {
                ...existingAssignment.metadata,
                lastModified: new Date().toISOString()
              }
            };
            const result = await window.electronAPI.workloadAssignmentSave(updatedAssignment);
            if (result.success) {
              return { success: true, action: 'updated', taskName };
            } else {
              return { success: false, error: result.error, taskName };
            }
          }
          // User unchanged, no action needed
          return { success: true, action: 'unchanged', taskName };
        } else {
          // Create new assignment
          const assignment = {
            id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            projectId: project.id,
            projectName: project.projectName,
            rfaNumber: project.rfaNumber,
            hoursAllocated: project.totalTriage || 0,
            hoursSpent: 0,
            startDate: new Date().toISOString().split('T')[0],
            dueDate: project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : null,
            status: 'ASSIGNED',
            priority: project.priority || 'medium',
            taskType: taskType,
            assignedBy: '',
            notes: '',
            metadata: {
              createdAt: new Date().toISOString(),
              lastModified: new Date().toISOString(),
              assignedAt: new Date().toISOString()
            }
          };
          
          const result = await window.electronAPI.workloadAssignmentSave(assignment);
          if (result.success) {
            return { success: true, action: 'created', taskName };
          } else {
            return { success: false, error: result.error, taskName };
          }
        }
      };

      // Helper to delete assignment
      const deleteAssignment = async (assignmentId) => {
        try {
          const result = await window.electronAPI.workloadAssignmentDelete(assignmentId);
          return { success: result.success || false };
        } catch (error) {
          console.error('Error deleting assignment:', error);
          return { success: false, error: error.message };
        }
      };

      // Sync TRIAGE assignment
      const triageResults = [];
      if (project.triagedBy) {
        const triageUser = await findUserByName(project.triagedBy);
        if (triageUser) {
          const result = await createOrUpdateAssignment(triageUser, 'TRIAGE', 'Triage');
          triageResults.push(result);
        }
      } else {
        // Remove triage assignment if field is cleared
        const triageAssignment = projectAssignments.find(a => a.taskType === 'TRIAGE');
        if (triageAssignment) {
          await deleteAssignment(triageAssignment.id);
        }
      }

      // Sync DESIGN assignment
      if (project.designBy) {
        const designUser = await findUserByName(project.designBy);
        if (designUser) {
          const result = await createOrUpdateAssignment(designUser, 'DESIGN', 'Design');
          triageResults.push(result);
        }
      } else {
        // Remove design assignment if field is cleared
        const designAssignment = projectAssignments.find(a => a.taskType === 'DESIGN');
        if (designAssignment) {
          await deleteAssignment(designAssignment.id);
        }
      }

      // Sync QC assignment
      if (project.qcBy) {
        const qcUser = await findUserByName(project.qcBy);
        if (qcUser) {
          const result = await createOrUpdateAssignment(qcUser, 'QC', 'QC');
          triageResults.push(result);
        }
      } else {
        // Remove QC assignment if field is cleared
        const qcAssignment = projectAssignments.find(a => a.taskType === 'QC');
        if (qcAssignment) {
          await deleteAssignment(qcAssignment.id);
        }
      }

      // Remove assignments for task types that no longer have users
      const validTaskTypes = [];
      if (project.triagedBy) validTaskTypes.push('TRIAGE');
      if (project.designBy) validTaskTypes.push('DESIGN');
      if (project.qcBy) validTaskTypes.push('QC');
      
      const assignmentsToRemove = projectAssignments.filter(
        a => a.taskType && !validTaskTypes.includes(a.taskType)
      );
      
      for (const assignment of assignmentsToRemove) {
        await deleteAssignment(assignment.id);
      }

    } catch (error) {
      console.error('Error syncing work task assignments:', error);
      // Don't throw - assignment sync failure shouldn't block project update
    }
  };

  const handleProjectUpdated = async (updatedProject, alreadySaved = false) => {
    try {
      let projectToUse = updatedProject;
      
      // Only save if not already saved by child component
      if (!alreadySaved) {
        console.log('💾 App.jsx: Saving project (not already saved)');
        const saveResult = await window.electronAPI.projectSave(updatedProject);
        
        if (saveResult.success) {
          projectToUse = saveResult.project;
          console.log('✅ App.jsx: Project saved successfully');
        } else {
          console.error('Failed to save updated project:', saveResult.error);
        }
      } else {
        console.log('✅ App.jsx: Using already-saved project data');
        console.log('✅ App.jsx: Project ECD:', projectToUse.ecd);
      }
      
      // Sync work task assignments
      await syncWorkTaskAssignments(projectToUse);
      
      // Update state with the project data
      setProjects(prev => 
        prev.map(p => p.id === projectToUse.id ? projectToUse : p)
      );
      setCurrentProject(projectToUse);
      console.log('✅ App.jsx: currentProject updated, ECD:', projectToUse.ecd);
      
    } catch (error) {
      console.error('Error updating project:', error);
      // Fallback to UI update only
      setProjects(prev => 
        prev.map(p => p.id === updatedProject.id ? updatedProject : p)
      );
      setCurrentProject(updatedProject);
    }
  };

  const handleFormDataChange = (newFormData) => {
    setFormData(newFormData);
  };

  const handleFormReset = async () => {
    const defaultData = createDefaultFormData();
    
    // Load user settings to set defaults for triagedBy and qcBy
    try {
      if (window.electronAPI?.settingsLoad) {
        const settingsResult = await window.electronAPI.settingsLoad();
        if (settingsResult?.success && settingsResult.data?.workloadSettings?.userName) {
          const userName = settingsResult.data.workloadSettings.userName;
          defaultData.triagedBy = userName;
          defaultData.qcBy = userName;
        }
      }
    } catch (error) {
      console.error('Failed to load user defaults for WorkTask fields:', error);
    }
    
    setFormData(defaultData);
  };

  // Handle project deletion
  const handleProjectDelete = async (projectId, projectName) => {
    try {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to delete the project "${projectName}"?\n\nThis action cannot be undone.`
      );
      
      if (!confirmed) {
        return;
      }

      console.log(`🗑️ Deleting project: ${projectId} (${projectName})`);
      
      // Call the delete API
      const deleteResult = await window.electronAPI.projectDelete(projectId);
      
      if (deleteResult.success) {
        // Remove project from local state
        setProjects(prev => prev.filter(p => p.id !== projectId));
        
        // Clear current project if it was the deleted one
        if (currentProject && currentProject.id === projectId) {
          setCurrentProject(null);
          setCurrentView('list'); // Navigate back to list if we were viewing the deleted project
        }
        
        console.log(`✅ Project deleted successfully: ${projectName}`);
        
        // Track deletion in analytics
        analyticsService.trackEvent('project_deleted', {
          projectId: projectId,
          projectName: projectName
        });
        
      } else {
        console.error('Failed to delete project:', deleteResult.error);
        alert(`Failed to delete project: ${deleteResult.error}`);
      }
      
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(`Error deleting project: ${error.message}`);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'project_deletion', projectId });
      crashReportingService.captureException(error, { context: 'project_deletion' });
    }
  };

  // Helper function to truncate project names to first 3 words
  const truncateProjectName = (name) => {
    if (!name) return '';
    const words = name.trim().split(' ');
    if (words.length <= 3) {
      return name;
    }
    return words.slice(0, 3).join(' ') + '...';
  };

  // Complete wizard reset function for both automatic and manual reset
  const handleWizardReset = () => {
    console.log('App: handleWizardReset called');
    handleFormReset();
    // Do NOT clear currentProject here - it will be cleared when user navigates away from project management
    // setCurrentProject(null); // REMOVED: This was causing the "Project Not Found" error
    // Additional wizard-specific resets will be handled by the wizard component
  };

  const handleViewChange = async (view) => {
    // Clear current project when navigating away from project management
    if (currentView === 'project-management' && view !== 'project-management') {
      console.log('App: Navigating away from project management, clearing current project');
      setCurrentProject(null);
    }
    
    // CRITICAL FIX: Refresh projects when navigating to list view to ensure latest data
    if (view === 'list') {
      console.log('🔄 App: Navigating to projects list, refreshing projects from storage');
      try {
        const projectsResult = await window.electronAPI.projectsLoadAll();
        if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
          setProjects(projectsResult.projects);
          console.log(`✅ App: Projects list refreshed, found ${projectsResult.projects.length} projects`);
        }
      } catch (error) {
        console.warn('⚠️ App: Failed to refresh projects list:', error);
      }
    }
    
    setCurrentView(view);
    
    // Track view change in analytics
    analyticsService.trackPageView(view, {
      previousView: currentView,
      hasCurrentProject: !!currentProject
    });
  };

  // Draft recovery handlers
  const handleResumeDraft = (draft) => {
    try {
      // Load draft data into form
      setFormData(draft.formData);
      setCurrentProject(null); // Clear any existing project
      
      // Navigate to wizard and go to the appropriate step
      setCurrentView('wizard');
      
      console.log('Resumed draft:', draft.id, 'at step', draft.currentStep);
      
      // Track draft recovery in analytics
      analyticsService.trackEvent('draft_recovered', {
        draftId: draft.id,
        step: draft.currentStep,
        projectType: draft.formData?.rfaType
      });
    } catch (error) {
      console.error('Error resuming draft:', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'draft_recovery' });
      crashReportingService.captureException(error, { context: 'draft_recovery' });
    }
  };

  const handleDeleteDraft = (draftId) => {
    // Refresh draft count after deletion
    if (draftService) {
      draftService.getAllDrafts().then(drafts => {
        setHasDrafts(drafts.length > 0);
      }).catch(error => {
        console.warn('Error refreshing draft count:', error);
      });
    }
  };

  // Migration assistant handlers
  const handleInterfaceSelection = (selectedInterface, remember) => {
    setUserInterfacePreference(selectedInterface);
    
    if (remember) {
      localStorage.setItem('interface-preference', selectedInterface);
    }
    
    // Navigate to the selected interface
    if (selectedInterface === 'wizard') {
      setCurrentView('wizard');
    } else if (selectedInterface === 'classic') {
      setCurrentView('form');
    }
    
    console.log(`User selected interface: ${selectedInterface}, remember: ${remember}`);
  };

  // Smart view change handler that respects feature flags
  const handleSmartViewChange = (view) => {
    // If trying to access wizard or form, check feature flags and preferences
    if (view === 'form' || view === 'wizard') {
      
      // Check if wizard is forced
      if (featureFlagService.isWizardForced() && view === 'form') {
        setCurrentView('wizard');
        return;
      }
      
      // Check if classic form is disabled
      if (!featureFlagService.isWizardEnabled() && view === 'wizard') {
        setCurrentView('form');
        return;
      }
      
      // Use default interface preference if no specific view requested
      if (view === 'form' && featureFlagService.isWizardDefault() && userInterfacePreference !== 'classic') {
        setCurrentView('wizard');
        return;
      }
    }
    
    setCurrentView(view);
  };

  // Get recommended interface for new project creation
  const getRecommendedInterface = () => {
    // Check feature flags first
    if (featureFlagService.isWizardForced()) return 'wizard';
    if (!featureFlagService.isWizardEnabled()) return 'form';
    
    // Use user preference if set
    if (userInterfacePreference) {
      return userInterfacePreference === 'wizard' ? 'wizard' : 'form';
    }
    
    // Use feature flag default
    if (featureFlagService.isWizardDefault()) return 'wizard';
    
    return 'form'; // Fallback to classic
  };

  // Helper for personalized greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = settings?.workloadSettings?.userName || '';
    const nameStr = userName ? `, ${userName.split(' ')[0]}` : '';

    if (hour < 12) return `Good morning${nameStr}`;
    if (hour < 18) return `Good afternoon${nameStr}`;
    return `Good evening${nameStr}`;
  };

  // Render main content based on current view
  const renderMainContent = () => {
    console.log('🎯 App: renderMainContent called with currentView =', currentView);
    try {
      switch (currentView) {
        case 'wizard':
          try {
            return (
              <div className="wizard-wrapper">
                <ProjectWizard
                  mode={currentProject ? 'edit' : 'create'}
                  existingProject={currentProject}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  onProjectCreated={handleProjectCreated}
                  onProjectUpdated={handleProjectUpdated}
                  onCancel={() => setCurrentView('welcome')}
                  onWizardReset={handleWizardReset}
                  onNavigateToSettings={(tab = 'triage-calc') => {
                    setSettingsTab(tab);
                    setCurrentView('settings');
                  }}
                />
              </div>
            );
          } catch (error) {
            console.error('Error rendering ProjectWizard:', error);
            return (
              <div className="wizard-error">
                <h2>⚠️ Wizard Error</h2>
                <p>Unable to load the Project Wizard. Error: {error.message}</p>
                <button onClick={() => setCurrentView('welcome')} className="btn btn-secondary">
                  Go Back to Welcome
                </button>
                <button onClick={() => window.location.reload()} className="btn btn-primary">
                  Reload Application
                </button>
              </div>
            );
          }
        case 'form':
          return (
            <ProjectForm
              project={currentProject}
              formData={formData}
              onFormDataChange={handleFormDataChange}
              onFormReset={handleFormReset}
              onProjectCreated={handleProjectCreated}
              onProjectUpdated={handleProjectUpdated}
            />
          );
        case 'list':
          return (
            <ProjectList
              projects={projects}
              onProjectSelect={(project) => {
                setCurrentProject(project);
                setCurrentView('project-management');
              }}
              onProjectDelete={handleProjectDelete}
              onNewProject={() => handleSmartViewChange('wizard')}
              onRefresh={async () => {
                console.log('🔄 Manual refresh triggered');
                try {
                  const projectsResult = await window.electronAPI.projectsLoadAll();
                  if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
                    setProjects(projectsResult.projects);
                    console.log(`✅ Manual refresh completed, found ${projectsResult.projects.length} projects`);
                    
                    // Also scan Ready for QC folder during refresh
                    try {
                      const scanResult = await window.electronAPI.qcScanFolder();
                      if (scanResult.success && scanResult.updatedProjects && scanResult.updatedProjects.length > 0) {
                        // Update projects list with updated statuses
                        const updatedProjectsMap = new Map(scanResult.updatedProjects.map(p => [p.id, p]));
                        setProjects(prevProjects => 
                          prevProjects.map(p => {
                            const updated = updatedProjectsMap.get(p.id);
                            return updated || p;
                          })
                        );
                        console.log(`✅ Refresh scan: Updated ${scanResult.updateCount} project(s) to "Ready for QC"`);
                      }
                    } catch (scanError) {
                      console.warn('⚠️ Refresh scan failed:', scanError);
                    }
                  }
                } catch (error) {
                  console.warn('⚠️ Manual refresh failed:', error);
                }
              }}
            />
          );
        case 'project-management':
          console.log('🎯 App: Rendering project-management view');
          console.log('🎯 App: currentProject =', currentProject);
          console.log('🎯 App: currentProject type =', typeof currentProject);
          console.log('🎯 App: currentProject keys =', currentProject ? Object.keys(currentProject) : 'no project');
          return (
            <ProjectManagement
              project={currentProject}
              onProjectUpdated={handleProjectUpdated}
              onProjectDelete={handleProjectDelete}
              onBack={() => setCurrentView('list')}
              mode="view"
            />
          );
        case 'agencies':
          return (
            <AgencyDirectory 
              onAgencySelect={(agency) => {
                setCurrentAgency(agency);
                setCurrentView('agency-dashboard');
              }}
            />
          );
        case 'agency-dashboard':
          return (
            <AgencyDashboard 
              agency={currentAgency}
              onBack={() => {
                setCurrentAgency(null);
                setCurrentView('agencies');
              }}
              onProjectSelect={(project) => {
                setCurrentProject(project);
                setCurrentView('project-management');
              }}
            />
          );
        case 'workload':
          // Guard: redirect to welcome if workload dashboard is disabled
          if (!featureFlagService.isWorkloadDashboardEnabled()) {
            setCurrentView('welcome');
            return null;
          }
          return <WorkloadDashboard 
            onNavigateToProject={(project) => {
              setCurrentProject(project);
              setCurrentView('project-management');
            }}
            onNavigateToSettings={(tab) => {
              setSettingsTab(tab);
              setCurrentView('settings');
            }}
          />;
        case 'agile-monitor':
          return (
            <AgileMonitorView
              onNavigateToWizard={() => setCurrentView('wizard')}
              onImportRfaData={(rfaData) => {
                if (rfaData) {
                  setFormData((prev) => ({
                    ...prev,
                    rfaNumber: rfaData.rfaNumber ?? prev.rfaNumber,
                    rfaType: rfaData.rfaType ?? prev.rfaType,
                    projectName: rfaData.projectName ?? prev.projectName,
                    projectContainer: rfaData.projectContainer ?? prev.projectContainer,
                    agentNumber: rfaData.agentNumber ?? prev.agentNumber,
                    ecd: rfaData.ecd ?? prev.ecd,
                    rfaStatus: rfaData.status ?? prev.rfaStatus,
                    ...(rfaData.assignedTo != null && { assignedTo: rfaData.assignedTo }),
                    ...(rfaData.priority != null && { complexity: rfaData.priority }),
                    ...(rfaData.nationalAccount != null && { nationalAccount: rfaData.nationalAccount }),
                    ...(rfaData.requestedDate != null && { requestedDate: rfaData.requestedDate }),
                    ...(rfaData.submittedDate != null && { submittedDate: rfaData.submittedDate }),
                    ...(rfaData.notes != null && { rfaNotes: rfaData.notes }),
                    ...(rfaData.documents != null && { rfaDocuments: rfaData.documents })
                  }));
                }
                setCurrentView('wizard');
              }}
            />
          );
        case 'das-general':
          return <DASGeneralPage />;
        case 'settings':
          return <Settings 
            initialTab={settingsTab} 
            onLaunchOnboarding={() => setShowMigrationAssistant(true)} 
          />;
        case 'welcome':
        default:
          return (
            <div className="flex flex-col gap-12 py-8 max-w-7xl mx-auto animate-fadeIn">
              {/* Modern Hero Section */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 p-12 text-white shadow-2xl animate-fadeIn">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-secondary-400/20 blur-3xl animate-float"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="mb-6 inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-md border border-white/20">
                    <span className="flex h-2 w-2 rounded-full bg-success-400 animate-pulse mr-2"></span>
                    <span className="text-sm font-medium tracking-wide uppercase">{getVersionDisplay()}</span>
                  </div>
                  
                  <h1 className="mb-4 text-6xl font-extrabold tracking-tight text-balance">
                    {getGreeting()}
                  </h1>
                  
                  <p className="mx-auto max-w-2xl text-xl text-primary-50 opacity-90 font-light leading-relaxed text-balance">
                    Streamline your workflow with Project Creator. Professional project management and document automation at your fingertips.
                  </p>

                  {/* Quick Stats Bar */}
                  <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
                    <div className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/20 transition-colors">
                      <span className="text-3xl font-bold">{projects.length}</span>
                      <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-semibold">Active Projects</span>
                    </div>
                    <div className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/20 transition-colors">
                      <span className="text-3xl font-bold">{hasDrafts ? 'Active' : 'None'}</span>
                      <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-semibold">Pending Drafts</span>
                    </div>
                    <div className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/20 transition-colors">
                      <span className="text-3xl font-bold">5.0</span>
                      <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-semibold">System Stability</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="my-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Platform Capabilities
                  </h2>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700 ml-6"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 h-auto md:h-[500px]">
                  {/* Feature 1: Large Card */}
                  <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 p-8 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
                      <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-4v-4h4v4zm0-6h-4V7h4v4z"/></svg>
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
                        <span className="text-3xl">📁</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Project Management</h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg mb-8">
                        Centralize your entire workflow. Create, edit, and organize projects with comprehensive metadata including RFA numbers and regional team tracking.
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">RFA Tracking</span>
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">Team Assignment</span>
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">Metadata</span>
                      </div>
                    </div>
                  </div>

                  {/* Feature 2: Medium Card */}
                  <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-start gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 group-hover:rotate-12 transition-transform">
                        <span className="text-2xl">📊</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Triage Calculations</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                          Advanced time estimation for LMPs, ARPs, and room counts with automatic complexity scaling.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature 3: Small Card */}
                  <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <span className="text-3xl mb-3 group-hover:scale-125 transition-transform">📝</span>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">Automation</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Word & Template Sync</p>
                    </div>
                  </div>

                  {/* Feature 4: Small Card */}
                  <div className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex flex-col items-center text-center">
                      <span className="text-3xl mb-3 group-hover:scale-125 transition-transform">🗂️</span>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">Structure</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Auto-Folder Creation</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 my-8">
                {/* Primary Actions */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Action Center
                    </h2>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700 ml-6"></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <button 
                      onClick={() => handleSmartViewChange(getRecommendedInterface())}
                      className="group relative flex flex-col items-start p-8 rounded-3xl bg-primary-600 text-white shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1"
                    >
                      <div className="mb-4 rounded-2xl bg-white/20 p-3">
                        <span className="text-3xl">🧙‍♂️</span>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">New Project</h3>
                      <p className="text-primary-100 text-left leading-relaxed">
                        Start the guided wizard to create a new project with automated documentation.
                      </p>
                      <div className="mt-6 flex items-center text-sm font-bold uppercase tracking-widest">
                        Launch Wizard
                        <svg className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                      </div>
                    </button>

                    <div className="grid grid-rows-2 gap-6">
                      <button 
                        onClick={() => setCurrentView('list')}
                        className="group flex items-center gap-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400 group-hover:scale-110 transition-transform">
                          <span className="text-2xl">📋</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">All Projects</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{projects.length} saved projects</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => setCurrentView('settings')}
                        className="group flex items-center gap-6 p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 group-hover:rotate-12 transition-transform">
                          <span className="text-2xl">⚙️</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">Settings</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">App preferences</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Quick Tips Section */}
                  <div className="mt-12 p-8 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <span className="text-8xl italic font-serif">i</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="text-primary-500">💡</span> Professional Tips
                    </h4>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3 text-gray-600 dark:text-gray-400 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0"></span>
                        Use the <strong>Sidebar</strong> to quickly toggle between active project views and settings.
                      </li>
                      <li className="flex items-start gap-3 text-gray-600 dark:text-gray-400 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 mt-1.5 shrink-0"></span>
                        Enable <strong>Dark Mode</strong> in Header for better visibility in low-light environments.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Recent Activity Sidebar */}
                <div className="lg:col-span-1">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Recent Activity
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {hasDrafts && (
                      <div 
                        onClick={() => setShowDraftRecovery(true)}
                        className="p-6 rounded-3xl bg-warning-50 dark:bg-warning-900/10 border-2 border-dashed border-warning-200 dark:border-warning-800 cursor-pointer hover:bg-warning-100 dark:hover:bg-warning-900/20 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-gray-800 text-warning-600 shadow-sm">
                            <span className="text-xl">📋</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-warning-900 dark:text-warning-300">Resume Work</h4>
                            <p className="text-xs text-warning-700 dark:text-warning-400">Unfinished drafts found</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {projects.length > 0 ? (
                      [...projects]
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                        .slice(0, 4)
                        .map(project => (
                          <div 
                            key={project.id}
                            onClick={() => {
                              setCurrentProject(project);
                              setCurrentView('project-management');
                            }}
                            className="group p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-gray-900 dark:text-white truncate pr-4 text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {project.projectName}
                              </h4>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {project.rfaNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                project.status === 'Completed' 
                                  ? 'bg-success-50 text-success-700' 
                                  : 'bg-primary-50 text-primary-700'
                              }`}>
                                {project.status || 'In Progress'}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(project.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12 px-6 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700">
                        <span className="text-4xl block mb-4">📭</span>
                        <p className="text-sm text-gray-500">No recent activity found. Start a new project to get started.</p>
                      </div>
                    )}
                    
                    {projects.length > 4 && (
                      <button 
                        onClick={() => setCurrentView('list')}
                        className="w-full py-3 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors"
                      >
                        View All Projects →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
      }
    } catch (error) {
      console.error('Error rendering main content:', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'main_content_render' });
      crashReportingService.captureException(error, { context: 'main_content_render' });
      
      return (
        <div className="error-container">
          <h2>Error Loading Content</h2>
          <p>There was an error loading the application content.</p>
          <p>Error: {error.message}</p>
          <button onClick={() => window.location.reload()}>Reload Application</button>
        </div>
      );
    }
  };

  // Show loading screen while initializing
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-primary-500 to-secondary-500 text-white text-center font-sans">
        <img src={logoUrl} alt="Project Creator Logo" className="w-20 h-20 mb-8 drop-shadow-lg" />
        <h1 className="text-4xl mb-4 drop-shadow-md font-light">Project Creator</h1>
        <p className="text-xl opacity-90 mb-8 leading-relaxed">Loading modern application...</p>
        <div className="spinner"></div>
      </div>
    );
  }

    return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={handleSmartViewChange}
          projectCount={projects.length}
        />
        <main className="flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-800 rounded-tl-lg shadow-lg custom-scrollbar">
          {renderMainContent()}
        </main>
      </div>
      
      {/* Draft Recovery Modal */}
      {showDraftRecovery && (
        <DraftRecoveryModal
          isOpen={showDraftRecovery}
          onClose={() => setShowDraftRecovery(false)}
          onResumeDraft={handleResumeDraft}
          onDeleteDraft={handleDeleteDraft}
          draftService={draftService}
        />
      )}
      
      {/* Migration Assistant */}
      {showMigrationAssistant && (
        <MigrationAssistant
          isOpen={showMigrationAssistant}
          onClose={() => setShowMigrationAssistant(false)}
          onSelectInterface={handleInterfaceSelection}
          currentInterface={currentView}
          showComparison={true}
        />
      )}
      
      {/* Update Notification - temporarily disabled */}
    </div>
  );
}

export default App;
