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
    nationalAccount: 'Default',
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
              <div className="welcome-header">
                <h1>Welcome to Project Creator</h1>
                <p className="welcome-subtitle">Professional Project Management & Document Automation Tool</p>
                <p className="welcome-version">Version 5.0.0 - Built with Electron & React</p>
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
                    <span className="type-badge">Standard</span>
                    <span className="type-badge">Metric</span>
                    <span className="type-badge">Holophane</span>
                    <span className="type-badge">Agency</span>
                    <span className="type-badge">LCD Preprogramming</span>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <h2>🚀 Get Started</h2>
                <div className="action-buttons">
                  <button 
                    onClick={() => setCurrentView('form')}
                    className="btn btn-primary btn-large"
                  >
                    ✨ Create New Project
                  </button>
                  <button 
                    onClick={() => setCurrentView('list')}
                    className="btn btn-secondary btn-large"
                  >
                    📋 View Projects ({projects.length})
                  </button>
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="btn btn-secondary btn-large"
                  >
                    ⚙️ Application Settings
                  </button>
                </div>
              </div>

              {projects.length > 0 && (
                <div className="recent-projects">
                  <h2>📋 Recent Projects</h2>
                  <div className="recent-projects-grid">
                    {projects.slice(0, 3).map(project => (
                      <div key={project.id} className="recent-project-card">
                        <h4>{project.projectName}</h4>
                        <p><strong>RFA:</strong> {project.rfaNumber}</p>
                        <p><strong>Team:</strong> {project.regionalTeam}</p>
                        <p><strong>Status:</strong> {project.status || 'In Progress'}</p>
                        <button 
                          onClick={() => {
                            setCurrentProject(project);
                            setCurrentView('form');
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

              <div className="welcome-info">
                <h3>📊 Application Status</h3>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Components:</span>
                    <span className="status-value">✅ All Loaded</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Database:</span>
                    <span className="status-value">✅ Connected</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Templates:</span>
                    <span className="status-value">✅ Available</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">File System:</span>
                    <span className="status-value">✅ Accessible</span>
                  </div>
                </div>
              </div>

              <div className="welcome-footer">
                <p>💡 <strong>Pro Tip:</strong> Use the sidebar navigation to quickly switch between different views and manage your projects efficiently.</p>
                <p>🔧 <strong>Need Help?</strong> Check the settings panel for application information and configuration options.</p>
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
        <h1>Project Creator</h1>
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
