import React, { useState, useEffect } from 'react';

/**
 * MigrationAssistant (OnboardingTutorial) - Helps new users learn the application features
 * Features: Interactive tutorial, feature walkthroughs, quick tips
 */
const MigrationAssistant = ({ 
  isOpen, 
  onClose, 
  onSelectInterface, 
  currentInterface = 'classic',
  showComparison = true 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [userPreference, setUserPreference] = useState(null);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Updated onboarding tutorial steps - focused on actual features
  const tutorialSteps = [
    {
      title: "Welcome to Project Creator!",
      content: "Let's take a quick tour of the main features to help you get started. You can exit anytime or revisit this tutorial from Settings.",
      icon: "🎉",
      features: []
    },
    {
      title: "Creating Projects with the Wizard",
      content: "Use the Project Wizard to create new projects with guided step-by-step setup.",
      icon: "🧙‍♂️",
      features: [
        "Fill in project details (RFA #, Agent #, Project Name)",
        "Configure triage calculations for time estimation",
        "Auto-save keeps your progress safe",
        "Access from sidebar or welcome page"
      ],
      tip: "💡 Tip: Click 'Start Project Wizard' from the welcome page to begin!"
    },
    {
      title: "Managing Your Projects",
      content: "View, search, and organize all your projects in one place.",
      icon: "📁",
      features: [
        "View all projects in table or grouped view",
        "Search by project name, RFA, or agent number",
        "Sort by date, triage time, or other fields",
        "Click any project to view full details and export options"
      ],
      tip: "💡 Tip: Use the 'Projects' button in the sidebar to access your project list."
    },
    {
      title: "Agency Directory",
      content: "Manage and search agency contacts with filtering and export capabilities.",
      icon: "📇",
      features: [
        "Search agencies by name, region, or role",
        "Filter by region and role type",
        "View statistics and contact information",
        "Export agency data for reports"
      ],
      tip: "💡 Tip: Access the Agency Directory from the sidebar or welcome page."
    },
    {
      title: "Triage Calculations",
      content: "Automatically calculate project time estimates based on complexity and scope.",
      icon: "📊",
      features: [
        "Enter LMPs (Large, Medium, Small) and ARPs",
        "Configure room counts and page numbers",
        "Get automatic time calculations",
        "Customize calculation settings in Settings"
      ],
      tip: "💡 Tip: Triage calculations appear in Step 2 of the Project Wizard."
    },
    {
      title: "Settings & Customization",
      content: "Customize the application to match your workflow and preferences.",
      icon: "⚙️",
      features: [
        "Configure triage calculation multipliers",
        "Manage agency contacts and details",
        "View app version and system info",
        "Access this onboarding tutorial anytime"
      ],
      tip: "💡 Tip: Find Settings in the sidebar - look for the gear icon ⚙️"
    }
  ];

  useEffect(() => {
    // Check if user has seen tutorial before
    const seenTutorial = localStorage.getItem('migration-tutorial-seen') === 'true';
    setHasSeenTutorial(seenTutorial);
    
    // Load user's previous interface preference
    const savedPreference = localStorage.getItem('interface-preference');
    if (savedPreference) {
      setUserPreference(savedPreference);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial completed, close and mark as seen
      handleComplete();
    }
  };

  const handleComplete = () => {
    // Mark tutorial as seen
    localStorage.setItem('migration-tutorial-seen', 'true');
    localStorage.setItem('onboarding-completed', 'true');
    setHasSeenTutorial(true);
    
    if (onSelectInterface) {
      onSelectInterface('wizard', false);
    }
    
    onClose();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Mark tutorial as seen even if skipped
    localStorage.setItem('migration-tutorial-seen', 'true');
    localStorage.setItem('onboarding-completed', 'true');
    setHasSeenTutorial(true);
    onClose();
  };

  const getProgressPercentage = () => {
    return ((currentStep + 1) / tutorialSteps.length) * 100;
  };

  const renderTutorialStep = () => {
    const step = tutorialSteps[currentStep];
    
    return (
      <div className="tutorial-step">
        <div className="step-header">
          <div className="step-icon">{step.icon}</div>
          <h3 className="step-title">{step.title}</h3>
        </div>
        
        <div className="step-content">
          <p className="step-description">{step.content}</p>
          
          {step.features.length > 0 && (
            <div className="feature-highlights">
              <h4>Key Features:</h4>
              <ul className="feature-list">
                {step.features.map((feature, index) => (
                  <li key={index} className="feature-item">
                    <span className="feature-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {step.tip && (
            <div className="step-tip">
              <p>{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    );
  };


  if (!isOpen) return null;

  return (
    <div className="migration-assistant-overlay">
      <div className="migration-assistant">
        <div className="assistant-header">
          <h2>Welcome to Project Creator - Quick Tour</h2>
          <button className="close-btn" onClick={handleSkip}>×</button>
        </div>
        
        {/* Progress Indicator */}
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div className="progress-text">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>
        </div>
        
        {/* Content */}
        <div className="assistant-content">
          {renderTutorialStep()}
        </div>
        
        {/* Navigation */}
        <div className="assistant-navigation">
          <div className="nav-left">
            {currentStep > 0 && (
              <button className="nav-btn secondary" onClick={handlePrevious}>
                ← Previous
              </button>
            )}
          </div>
          
          <div className="nav-center">
            <div className="step-dots">
              {tutorialSteps.map((_, index) => (
                <div 
                  key={index}
                  className={`step-dot ${index <= currentStep ? 'active' : ''}`}
                  onClick={() => setCurrentStep(index)}
                />
              ))}
            </div>
          </div>
          
          <div className="nav-right">
            <button className="nav-btn tertiary" onClick={handleSkip}>
              Skip Tutorial
            </button>
            <button className="nav-btn primary" onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Get Started! 🚀' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationAssistant;
