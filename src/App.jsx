import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProjectForm from './components/ProjectForm';
import ProjectWizard from './components/wizard/ProjectWizard';
import ProjectManagement from './components/ProjectManagement';
import ProjectList from './components/ProjectList';
import AgencyDirectory from './components/AgencyDirectory';
import WorkloadDashboard from './components/WorkloadDashboard';
import DraftRecoveryModal from './components/wizard/components/DraftRecoveryModal';
import MigrationAssistant from './components/wizard/components/MigrationAssistant';
import Settings from './components/Settings';
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
  assignedTo: '',
  repContacts: '',
  requestedDate: '',
  submittedDate: '',
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
  dasRepEmail: ''
});

function App() {
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('welcome');
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
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
        
        // CRITICAL FIX: Load existing projects from persistent storage
        try {
          const projectsResult = await window.electronAPI.projectsLoadAll();
          if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
            setProjects(projectsResult.projects);
            console.log(`✅ Loaded ${projectsResult.projects.length} existing projects from storage`);
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
      return;
    }
    
    if (!project.id) {
      console.error('❌ handleProjectCreated: Project missing ID!', project);
      return;
    }
    
    console.log('✅ handleProjectCreated: Project validation passed');
    
    try {
      // CRITICAL FIX: Reload all projects from persistent storage to ensure UI is in sync
      console.log('🔄 handleProjectCreated: Reloading all projects from storage to ensure sync');
      const projectsResult = await window.electronAPI.projectsLoadAll();
      
      if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
        console.log('✅ handleProjectCreated: Successfully reloaded projects from storage');
        console.log(`🔄 handleProjectCreated: Found ${projectsResult.projects.length} projects in storage`);
        
        // Update projects list with fresh data from storage
        setProjects(projectsResult.projects);
        
        // Find the newly created project in the fresh data
        const freshProject = projectsResult.projects.find(p => p.id === project.id);
        if (freshProject) {
          console.log('✅ handleProjectCreated: Found newly created project in fresh data:', freshProject);
          setCurrentProject(freshProject);
        } else {
          console.log('⚠️ handleProjectCreated: Using provided project data as fallback:', project);
          setCurrentProject(project);
        }
        
      } else {
        console.warn('⚠️ handleProjectCreated: Failed to reload projects, using fallback approach');
        // Fallback to original approach
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
        setCurrentProject(project);
      }
      
      // Navigate to project management with a small delay to ensure state updates complete
      setTimeout(() => {
        console.log('🎯 handleProjectCreated: Setting current view to project-management');
        setCurrentView('project-management');
      }, 50); // Slightly longer delay to ensure all state updates complete
      
      console.log('✅ handleProjectCreated: All state updates completed');
      
    } catch (error) {
      console.error('❌ handleProjectCreated: Error during state updates:', error);
      // Fallback approach if reload fails
      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      setTimeout(() => {
        setCurrentView('project-management');
      }, 50);
    }
    
    // Track project creation in analytics
    try {
      analyticsService.trackProjectCreation(project, {
        projectType: project.rfaType,
        regionalTeam: project.regionalTeam,
        complexity: project.complexity
      });
      console.log('✅ handleProjectCreated: Analytics tracked successfully');
    } catch (analyticsError) {
      console.warn('⚠️ handleProjectCreated: Analytics tracking failed:', analyticsError);
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

  const handleFormReset = () => {
    setFormData(createDefaultFormData());
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
              onRefresh={async () => {
                console.log('🔄 Manual refresh triggered');
                try {
                  const projectsResult = await window.electronAPI.projectsLoadAll();
                  if (projectsResult && projectsResult.success && Array.isArray(projectsResult.projects)) {
                    setProjects(projectsResult.projects);
                    console.log(`✅ Manual refresh completed, found ${projectsResult.projects.length} projects`);
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
              onBack={() => setCurrentView('list')}
              mode="view"
            />
          );
        case 'agencies':
          return <AgencyDirectory />;
        case 'workload':
          return <WorkloadDashboard 
            onNavigateToProject={(project) => {
              setCurrentProject(project);
              setCurrentView('project-management');
            }}
          />;
        case 'settings':
          return <Settings 
            initialTab={settingsTab} 
            onLaunchOnboarding={() => setShowMigrationAssistant(true)} 
          />;
        case 'welcome':
        default:
          return (
            <div className="text-center px-6 py-4 max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-5xl text-gray-800 dark:text-gray-100 mb-4 font-light gradient-text">
                  Welcome to Project Creator
                </h1>
                <p className="text-2xl text-gray-600 dark:text-gray-400 mb-2 font-medium">
                  Professional Project Management & Document Automation Tool
                </p>
                <p className="text-base text-gray-500 dark:text-gray-500 italic">
                  {getFullVersionInfo()}
                </p>
              </div>

              <div className="my-8">
                <h2 className="text-3xl text-gray-800 dark:text-gray-100 my-6 font-normal">
                  🚀 Key Features
                </h2>
                <div className="grid grid-cols-3 gap-5 my-6">
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">📁</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">Project Management</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Create, edit, and organize projects with comprehensive metadata including RFA numbers, regional teams, and project complexity ratings.
                    </p>
                  </div>
                  
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">📊</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">Triage Calculations</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Advanced time estimation for LMPs, ARPs, room counts, and project complexity with automatic calculations and overrides.
                    </p>
                  </div>
                  
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">📝</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">Document Automation</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Generate Word documents, process design notes, and create project documentation with automated templates.
                    </p>
                  </div>
                  
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">🗂️</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">File Organization</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Automated folder structure creation, template management, and project file organization for server and desktop locations.
                    </p>
                  </div>
                  
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">📈</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">Export & Integration</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Export project data to DAS Board format, Agile triage reports, and multiple file formats for seamless workflow integration.
                    </p>
                  </div>
                  
                  <div className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5 hover:border-info-500 dark:hover:border-info-400">
                    <div className="text-3xl mb-3 block">⚙️</div>
                    <h3 className="text-gray-800 dark:text-gray-100 mb-2 text-lg font-semibold">Advanced Settings</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm m-0 leading-snug flex-1">
                      Customizable project defaults, template management, and user preferences for personalized project creation workflows.
                    </p>
                  </div>
                </div>
              </div>

              <div className="my-8">
                <h2 className="text-3xl text-gray-800 dark:text-gray-100 my-6 font-normal">
                  🎯 Supported Project Types
                </h2>
                <div className="flex justify-center my-6">
                  <div className="flex flex-wrap gap-3 justify-center">
                    <span className="badge bg-gradient-to-r from-info-500 to-info-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md hover:-translate-y-0.5 transition-transform">
                      Reloc
                    </span>
                    <span className="badge bg-gradient-to-r from-info-500 to-info-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md hover:-translate-y-0.5 transition-transform">
                      Photometrics
                    </span>
                    <span className="badge bg-gradient-to-r from-info-500 to-info-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md hover:-translate-y-0.5 transition-transform">
                      Standard Controls
                    </span>
                    <span className="badge bg-gradient-to-r from-info-500 to-info-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md hover:-translate-y-0.5 transition-transform">
                      DC2DC
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-8">
                <h2 className="text-3xl text-gray-800 dark:text-gray-100 my-6 font-normal">
                  🚀 Get Started
                </h2>
                
                {/* Draft Recovery Section */}
                {hasDrafts && (
                  <div className="my-8 p-0">
                    <div className="bg-gradient-to-r from-warning-50 to-warning-100 dark:from-warning-900/20 dark:to-warning-800/20 border-2 border-warning-500 rounded-xl p-5 flex items-center justify-between shadow-lg animate-slideIn">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="text-3xl bg-white dark:bg-gray-700 rounded-full p-3 shadow-md">
                          📋
                        </span>
                        <div>
                          <h3 className="m-0 mb-1 text-warning-700 dark:text-warning-300 text-lg font-semibold">
                            Continue Your Work
                          </h3>
                          <p className="m-0 text-warning-800 dark:text-warning-400 text-sm">
                            You have unfinished projects that can be resumed
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowDraftRecovery(true)}
                        className="btn-primary px-5 py-3 rounded-lg font-semibold shadow-md hover:-translate-y-0.5"
                      >
                        📖 Resume Projects
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-5 my-6 max-w-3xl mx-auto">
                  <button 
                    onClick={() => handleSmartViewChange(getRecommendedInterface())}
                    className={`
                      px-6 py-4 text-base min-w-[160px] flex flex-col items-stretch text-left h-auto
                      ${getRecommendedInterface() === 'wizard' 
                        ? 'btn-primary relative shadow-primary hover:shadow-lg animate-pulse-soft' 
                        : 'btn-secondary'
                      }
                    `}
                  >
                    {getRecommendedInterface() === 'wizard' ? '🧙‍♂️ Start Project Wizard' : '📝 Start Project Form'}
                    <span className="text-sm font-normal opacity-80 mt-2 block leading-tight">
                      {getRecommendedInterface() === 'wizard' 
                        ? 'Recommended: Guided step-by-step setup' 
                        : 'Quick project creation'
                      }
                    </span>
                    {getRecommendedInterface() === 'wizard' && (
                      <span className="absolute -top-2 -right-2 bg-warning-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-md">
                        ✨ NEW
                      </span>
                    )}
                  </button>
                  
                  {featureFlagService.isWizardEnabled() && getRecommendedInterface() !== 'wizard' && (
                    <button 
                      onClick={() => handleSmartViewChange('wizard')}
                      className="btn-secondary px-6 py-4 text-base min-w-[160px] flex flex-col items-stretch text-left h-auto"
                    >
                      🧙‍♂️ Try Project Wizard
                      <span className="text-sm font-normal opacity-80 mt-2 block leading-tight">
                        Enhanced guided experience
                      </span>
                    </button>
                  )}
                  
                  {getRecommendedInterface() !== 'form' && !featureFlagService.isWizardForced() && (
                    <button 
                      onClick={() => setCurrentView('agencies')}
                      className="btn-secondary px-6 py-4 text-base min-w-[160px] flex flex-col items-stretch text-left h-auto"
                    >
                      📇 Agency Directory
                      <span className="text-sm font-normal opacity-80 mt-2 block leading-tight">
                        Manage agency contacts
                      </span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setCurrentView('list')}
                    className="btn-secondary px-6 py-4 text-base min-w-[160px] flex flex-col items-stretch text-left h-auto"
                  >
                    📋 View Projects ({projects.length})
                    <span className="text-sm font-normal opacity-80 mt-2 block leading-tight">
                      Manage existing projects
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="btn-secondary px-6 py-4 text-base min-w-[160px] flex flex-col items-stretch text-left h-auto"
                  >
                    ⚙️ Application Settings
                    <span className="text-sm font-normal opacity-80 mt-2 block leading-tight">
                      Configure preferences
                    </span>
                  </button>
                </div>
              </div>

              {projects.length > 0 && (
                <div className="my-8">
                  <h2 className="text-3xl text-gray-800 dark:text-gray-100 mb-4 font-normal">
                    📋 Recent Projects
                  </h2>
                  <div className="grid grid-cols-3 gap-5 my-4">
                    {[...projects]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .slice(0, 3)
                      .map(project => (
                      <div key={project.id} className="card p-5 text-left h-full flex flex-col hover:-translate-y-0.5">
                        <h4 className="text-gray-800 dark:text-gray-100 mb-3 text-lg font-semibold">
                          {project.projectName}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 leading-tight flex-1">
                          <strong>RFA:</strong> {project.rfaNumber}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 leading-tight flex-1">
                          <strong>Team:</strong> {project.regionalTeam}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 leading-tight flex-1">
                          <strong>Status:</strong> {project.status || 'In Progress'}
                        </p>
                        <button 
                          onClick={() => {
                            setCurrentProject(project);
                            setCurrentView('project-management');
                          }}
                          className="btn-secondary px-4 py-2 text-sm min-w-[100px] mt-4"
                        >
                          Open Project
                        </button>
                      </div>
                    ))}
                  </div>
                  {projects.length > 3 && (
                    <div className="text-center mt-6">
                      <button 
                        onClick={() => setCurrentView('list')}
                        className="btn-secondary"
                      >
                        View All Projects ({projects.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-12 p-8 bg-gradient-to-r from-success-50 to-info-50 dark:from-success-900/20 dark:to-info-900/20 rounded-xl border border-success-200 dark:border-success-700 relative overflow-hidden">
                <p className="mb-3 text-success-800 dark:text-success-200 text-base relative z-10">
                  💡 <strong>Pro Tip:</strong> Use the sidebar navigation to quickly switch between different views and manage your projects efficiently.
                </p>
                <p className="mb-0 text-success-800 dark:text-success-200 text-base relative z-10">
                  🔧 <strong>Need Help?</strong> Check the settings panel for application information and configuration options.
                </p>
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
