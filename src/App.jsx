import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProjectForm from './components/ProjectForm';
import './App.css';

function App() {
  console.log('App component is initializing...');
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('welcome');
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState({
    projectName: '',
    rfaNumber: '',
    agentNumber: '',
    projectContainer: '',
    rfaType: '',
    regionalTeam: '',
    ecd: '',
    nationalAccount: '',
    complexity: '',
    rfaValue: '',
    status: '',
    products: '',
    assignedTo: '',
    repContacts: '',
    requestedDate: '',
    submittedDate: '',
    largeLMPs: 0,
    mediumLMPs: 0,
    smallLMPs: 0,
    arp8: 0,
    arp16: 0,
    arp32: 0,
    arp48: 0,
    esheetsSchedules: 2,
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
    fluff: 0
  });

  useEffect(() => {
    console.log('App useEffect running...');
    
    const initializeApp = async () => {
      try {
        console.log('Starting app initialization...');
        setIsLoading(true);
        
        // Simulate app initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('App initialization complete, setting loading to false');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  console.log('App render - isLoading:', isLoading, 'currentView:', currentView);

  const handleProjectCreated = (project) => {
    console.log('Project created:', project);
    setProjects(prev => [project, ...prev]);
    setCurrentProject(project);
    setCurrentView('welcome');
  };

  const handleProjectUpdated = (updatedProject) => {
    console.log('Project updated:', updatedProject);
    setProjects(prev => 
      prev.map(p => p.id === updatedProject.id ? updatedProject : p)
    );
    setCurrentProject(updatedProject);
  };

  const handleFormDataChange = (newFormData) => {
    console.log('Form data changed:', newFormData);
    setFormData(newFormData);
  };

  const handleFormReset = () => {
    console.log('Form reset');
    setFormData({
      projectName: '',
      rfaNumber: '',
      agentNumber: '',
      projectContainer: '',
      rfaType: '',
      regionalTeam: '',
      ecd: '',
      nationalAccount: '',
      complexity: '',
      rfaValue: '',
      status: '',
      products: '',
      assignedTo: '',
      repContacts: '',
      requestedDate: '',
      submittedDate: '',
      largeLMPs: 0,
      mediumLMPs: 0,
      smallLMPs: 0,
      arp8: 0,
      arp16: 0,
      arp32: 0,
      arp48: 0,
      esheetsSchedules: 2,
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
      fluff: 0
    });
  };

  const handleViewChange = (view) => {
    console.log('Changing view to:', view);
    setCurrentView(view);
  };

  // Render main content based on current view
  const renderMainContent = () => {
    try {
      console.log('Rendering main content for view:', currentView);
      
      switch (currentView) {
        case 'form':
          console.log('Rendering ProjectForm component');
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
          console.log('Rendering ProjectList view');
          return (
            <div className="projects-list-container">
              <h2>Projects List</h2>
              {projects.length === 0 ? (
                <div className="no-projects">
                  <p>No projects found.</p>
                  <button 
                    onClick={() => setCurrentView('form')}
                    className="btn btn-primary"
                  >
                    Create Your First Project
                  </button>
                </div>
              ) : (
                <div className="projects-grid">
                  {projects.map(project => (
                    <div key={project.id} className="project-card">
                      <h3>{project.projectName}</h3>
                      <p><strong>RFA:</strong> {project.rfaNumber}</p>
                      <p><strong>Team:</strong> {project.regionalTeam}</p>
                      <p><strong>Status:</strong> {project.status || 'In Progress'}</p>
                      <button 
                        onClick={() => {
                          setCurrentProject(project);
                          setCurrentView('form');
                        }}
                        className="btn btn-secondary"
                      >
                        Edit Project
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        case 'settings':
          console.log('Rendering Settings view');
          return (
            <div className="settings-container">
              <h2>Application Settings</h2>
              <div className="settings-section">
                <h3>General Settings</h3>
                <div className="setting-item">
                  <label>Application Version</label>
                  <span>5.0.0</span>
                </div>
                <div className="setting-item">
                  <label>Build Date</label>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="setting-item">
                  <label>Environment</label>
                  <span>Electron + React</span>
                </div>
              </div>
              
              <div className="settings-section">
                <h3>Project Settings</h3>
                <div className="setting-item">
                  <label>Default Save Location</label>
                  <span>Server</span>
                </div>
                <div className="setting-item">
                  <label>Auto-save Projects</label>
                  <span>Enabled</span>
                </div>
              </div>
              
              <div className="settings-section">
                <h3>Export Settings</h3>
                <div className="setting-item">
                  <label>DAS Board Integration</label>
                  <span>Coming Soon</span>
                </div>
                <div className="setting-item">
                  <label>Agile Integration</label>
                  <span>Coming Soon</span>
                </div>
              </div>
            </div>
          );
        case 'welcome':
        default:
          console.log('Rendering welcome content');
          return (
            <div className="welcome-container">
              <h1>Welcome to Project Creator 2024</h1>
              <p>✅ Loading phase completed successfully!</p>
              <p>✅ React is rendering the main content!</p>
              <p>✅ Header component added successfully!</p>
              <p>✅ Sidebar component added successfully!</p>
              <p>✅ ProjectForm component added successfully!</p>
              
              <div className="welcome-info">
                <p><strong>Current View:</strong> {currentView}</p>
                <p><strong>Loading State:</strong> {isLoading ? 'Loading...' : 'Complete'}</p>
                <p><strong>Components Loaded:</strong> Header ✅, Sidebar ✅, ProjectForm ✅</p>
              </div>

              <div className="welcome-actions">
                <button 
                  onClick={() => setCurrentView('form')}
                  className="btn btn-primary"
                >
                  Create New Project
                </button>
                <button 
                  onClick={() => setCurrentView('list')}
                  className="btn btn-secondary"
                >
                  View Projects
                </button>
                <button 
                  onClick={() => setCurrentView('settings')}
                  className="btn btn-secondary"
                >
                  Open Settings
                </button>
              </div>

              <div className="welcome-status">
                <p>✅ All components are working!</p>
                <p>Use the sidebar to navigate between different views.</p>
                <p>Current project count: {projects.length}</p>
              </div>
            </div>
          );
      }
    } catch (error) {
      console.error('Error rendering main content:', error);
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
    console.log('Rendering loading screen');
    return (
      <div className="loading-container">
        <img src="acuity.jpg" alt="Acuity Brands" className="logo" />
        <h1>Project Creator 2024</h1>
        <p>Loading modern application...</p>
        <div className="spinner"></div>
        <p>Built with Electron & React</p>
      </div>
    );
  }

  console.log('Rendering main app content with all components');
  
  return (
    <div className="app">
      <Header />
      <div className="app-container">
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          projectCount={projects.length}
        />
        <main className="main-content">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
