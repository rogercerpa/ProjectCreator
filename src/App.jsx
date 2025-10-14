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
// Use simple services that work in both main and renderer processes
import featureFlagService from './services/FeatureFlagService';
import crashReportingService from './services/SimpleCrashReportingService';
import analyticsService from './services/SimpleAnalyticsService';
import performanceMonitoringService from './services/SimplePerformanceMonitoringService';
// import autoUpdateService from './services/AutoUpdateService';
// import UpdateNotification from './components/UpdateNotification';
// import PerformanceDashboard from './components/PerformanceDashboard';
import { getFullVersionInfo, getVersionDisplay } from './utils/version';
import './App.css';

// Import draft service for enhanced recovery
const ProjectDraftService = window.electron ? 
  window.electron.require('./src/services/ProjectDraftService') : 
  null;

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
  const [formData, setFormData] = useState({
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
    hasPanelSchedules: false, // Panel Schedules YES/NO
    hasSubmittals: false, // Submittal Section YES/NO
    needsLayoutBOM: false, // Needs Layout/BOM created YES/NO (only shown when hasSubmittals = true)
    // Panel Schedule Fields
    largeLMPs: 0,
    mediumLMPs: 0,
    smallLMPs: 0,
    arp8: 0,
    arp16: 0,
    arp32: 0,
    arp48: 0,
    esheetsSchedules: 2, // 1 = Yes, 2 = No
    showPanelSchedules: false, // Keep for backward compatibility
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
    firstAvailable: false
  });

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
        
        // Simulate app initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
      // autoUpdateService.cleanup();
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

  const handleProjectUpdated = async (updatedProject) => {
    try {
      // Save updated project to persistent storage
      const saveResult = await window.electronAPI.projectSave(updatedProject);
      
      if (saveResult.success) {
        // Use the saved project data (which may have updated timestamps, etc.)
        const savedProject = saveResult.project;
        
        setProjects(prev => 
          prev.map(p => p.id === savedProject.id ? savedProject : p)
        );
        setCurrentProject(savedProject);
        console.log('✅ Project updated and saved:', savedProject);
      } else {
        console.error('Failed to save updated project:', saveResult.error);
        // Still update UI but warn user
        setProjects(prev => 
          prev.map(p => p.id === updatedProject.id ? updatedProject : p)
        );
        setCurrentProject(updatedProject);
      }
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
    setFormData({
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
      // Panel Schedule Fields
      largeLMPs: 0,
      mediumLMPs: 0,
      smallLMPs: 0,
      arp8: 0,
      arp16: 0,
      arp32: 0,
      arp48: 0,
      esheetsSchedules: 2, // 1 = Yes, 2 = No
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
      firstAvailable: false
    });
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
            <div className="welcome-container">
                             <div className="welcome-header">
                 <h1>Welcome to Project Creator</h1>
                 <p className="welcome-subtitle">Professional Project Management & Document Automation Tool</p>
                 <p className="welcome-version">{getFullVersionInfo()}</p>
               </div>

              <div className="feature-highlights">
                <h2>🚀 Key Features</h2>
                <div className="features-grid">
                  <div className="feature-card">
                    <div className="feature-icon">📁</div>
                    <h3>Project Management</h3>
                    <p>Create, edit, and organize projects with comprehensive metadata including RFA numbers, regional teams, and project complexity ratings.</p>
                  </div>
                  
                  <div className="feature-card">
                    <div className="feature-icon">📊</div>
                    <h3>Triage Calculations</h3>
                    <p>Advanced time estimation for LMPs, ARPs, room counts, and project complexity with automatic calculations and overrides.</p>
                  </div>
                  
                  <div className="feature-card">
                    <div className="feature-icon">📝</div>
                    <h3>Document Automation</h3>
                    <p>Generate Word documents, process design notes, and create project documentation with automated templates.</p>
                  </div>
                  
                  <div className="feature-card">
                    <div className="feature-icon">🗂️</div>
                    <h3>File Organization</h3>
                    <p>Automated folder structure creation, template management, and project file organization for server and desktop locations.</p>
                  </div>
                  
                  <div className="feature-card">
                    <div className="feature-icon">📈</div>
                    <h3>Export & Integration</h3>
                    <p>Export project data to DAS Board format, Agile triage reports, and multiple file formats for seamless workflow integration.</p>
                  </div>
                  
                  <div className="feature-card">
                    <div className="feature-icon">⚙️</div>
                    <h3>Advanced Settings</h3>
                    <p>Customizable project defaults, template management, and user preferences for personalized project creation workflows.</p>
                  </div>
                </div>
              </div>

              <div className="project-types">
                <h2>🎯 Supported Project Types</h2>
                <div className="project-types-grid">
                  <div className="project-type">
                    <span className="type-badge">Reloc</span>
                    <span className="type-badge">Photometrics</span>
                    <span className="type-badge">Standard Controls</span>
                    <span className="type-badge">DC2DC</span>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <h2>🚀 Get Started</h2>
                
                {/* Draft Recovery Section */}
                {hasDrafts && (
                  <div className="draft-recovery-section">
                    <div className="recovery-banner">
                      <div className="recovery-content">
                        <span className="recovery-icon">📋</span>
                        <div className="recovery-text">
                          <h3>Continue Your Work</h3>
                          <p>You have unfinished projects that can be resumed</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowDraftRecovery(true)}
                        className="btn btn-primary recovery-btn"
                      >
                        📖 Resume Projects
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="action-buttons">
                  <button 
                    onClick={() => handleSmartViewChange(getRecommendedInterface())}
                    className={`btn btn-large ${getRecommendedInterface() === 'wizard' ? 'btn-primary featured-btn' : 'btn-secondary'}`}
                  >
                    {getRecommendedInterface() === 'wizard' ? '🧙‍♂️ Start Project Wizard' : '📝 Start Project Form'}
                    <span className="btn-subtitle">
                      {getRecommendedInterface() === 'wizard' 
                        ? 'Recommended: Guided step-by-step setup' 
                        : 'Quick project creation'
                      }
                    </span>
                  </button>
                  
                  {featureFlagService.isWizardEnabled() && getRecommendedInterface() !== 'wizard' && (
                    <button 
                      onClick={() => handleSmartViewChange('wizard')}
                      className="btn btn-secondary btn-large"
                    >
                      🧙‍♂️ Try Project Wizard
                      <span className="btn-subtitle">Enhanced guided experience</span>
                    </button>
                  )}
                  
                  {getRecommendedInterface() !== 'form' && !featureFlagService.isWizardForced() && (
                    <button 
                      onClick={() => setCurrentView('agencies')}
                      className="btn btn-secondary btn-large"
                    >
                      📇 Agency Directory
                      <span className="btn-subtitle">Manage agency contacts</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setCurrentView('list')}
                    className="btn btn-secondary btn-large"
                  >
                    📋 View Projects ({projects.length})
                    <span className="btn-subtitle">Manage existing projects</span>
                  </button>
                  
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="btn btn-secondary btn-large"
                  >
                    ⚙️ Application Settings
                    <span className="btn-subtitle">Configure preferences</span>
                  </button>
                </div>
              </div>

              {projects.length > 0 && (
                <div className="recent-projects">
                  <h2>📋 Recent Projects</h2>
                  <div className="recent-projects-grid">
                    {[...projects]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .slice(0, 3)
                      .map(project => (
                      <div key={project.id} className="recent-project-card">
                        <h4>{project.projectName}</h4>
                        <p><strong>RFA:</strong> {project.rfaNumber}</p>
                        <p><strong>Team:</strong> {project.regionalTeam}</p>
                        <p><strong>Status:</strong> {project.status || 'In Progress'}</p>
                        <button 
                          onClick={() => {
                            setCurrentProject(project);
                            setCurrentView('project-management');
                          }}
                          className="btn btn-secondary btn-small"
                        >
                          Open Project
                        </button>
                      </div>
                    ))}
                  </div>
                  {projects.length > 3 && (
                    <div className="view-all-projects">
                      <button 
                        onClick={() => setCurrentView('list')}
                        className="btn btn-secondary"
                      >
                        View All Projects ({projects.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="welcome-footer">
                <p>💡 <strong>Pro Tip:</strong> Use the sidebar navigation to quickly switch between different views and manage your projects efficiently.</p>
                <p>🔧 <strong>Need Help?</strong> Check the settings panel for application information and configuration options.</p>
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
      <div className="loading-container">
        <img src="logo.png" alt="Project Creator Logo" className="logo" />
        <h1>Project Creator</h1>
        <p>Loading modern application...</p>
        <div className="spinner"></div>
      </div>
    );
  }

    return (
    <div className="app">
      <Header />
      <div className="app-container">
        <Sidebar
          currentView={currentView}
          onViewChange={handleSmartViewChange}
          projectCount={projects.length}
        />
        <main className="main-content">
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
      {/* <UpdateNotification /> */}
      
      {/* Performance Dashboard - temporarily disabled */}
      {/* <PerformanceDashboard /> */}
    </div>
  );
}

export default App;
