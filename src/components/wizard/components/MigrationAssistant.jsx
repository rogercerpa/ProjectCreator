import React, { useState, useEffect } from 'react';
import featureFlagService from '../../../services/FeatureFlagService';

/**
 * MigrationAssistant - Helps users transition from classic form to wizard
 * Features: Interactive tutorial, feature comparison, guided migration, preferences
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

  // Migration tutorial steps
  const tutorialSteps = [
    {
      title: "Welcome to the Enhanced Project Creator!",
      content: "We've redesigned the project creation experience to be more intuitive and powerful.",
      icon: "🎉",
      features: []
    },
    {
      title: "Meet the Project Wizard",
      content: "The new wizard guides you through project creation step-by-step, ensuring nothing is missed.",
      icon: "🧙‍♂️",
      features: [
        "Step-by-step guidance",
        "Automatic progress saving", 
        "Smart field suggestions",
        "Enhanced validation"
      ]
    },
    {
      title: "Your Data is Safe",
      content: "All your work is automatically saved as you progress, so you never lose your changes.",
      icon: "💾",
      features: [
        "Auto-save every 30 seconds",
        "Draft recovery system",
        "Resume incomplete projects",
        "Data backup & restore"
      ]
    },
    {
      title: "Intelligent Assistance",
      content: "The wizard learns from your patterns and suggests smart defaults to speed up your workflow.",
      icon: "🧠",
      features: [
        "Context-aware suggestions",
        "Learning from your patterns",
        "Pre-filled common values",
        "RFA-type specific defaults"
      ]
    },
    {
      title: "Enhanced Experience",
      content: "Beautiful interface with real-time feedback, tooltips, and mobile responsiveness.",
      icon: "✨",
      features: [
        "Modern, intuitive design",
        "Real-time calculation preview",
        "Contextual help & tooltips",
        "Mobile-friendly interface"
      ]
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
      // Tutorial completed, show interface selection
      setCurrentStep(tutorialSteps.length);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInterfaceSelection = (selectedInterface, remember = false) => {
    setUserPreference(selectedInterface);
    
    if (remember) {
      localStorage.setItem('interface-preference', selectedInterface);
      
      // Set feature flag override based on preference
      if (selectedInterface === 'wizard') {
        featureFlagService.setUserOverride('wizard-as-default', true, 'user-preference');
      } else if (selectedInterface === 'classic') {
        featureFlagService.setUserOverride('wizard-as-default', false, 'user-preference');
      }
    }
    
    // Mark tutorial as seen
    localStorage.setItem('migration-tutorial-seen', 'true');
    setHasSeenTutorial(true);
    
    if (onSelectInterface) {
      onSelectInterface(selectedInterface, remember);
    }
    
    onClose();
  };

  const getProgressPercentage = () => {
    return ((currentStep + 1) / (tutorialSteps.length + 1)) * 100;
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
        </div>
      </div>
    );
  };

  const renderInterfaceComparison = () => {
    return (
      <div className="interface-comparison">
        <h3>Choose Your Experience</h3>
        <p>Both options are available. Pick what works best for you!</p>
        
        <div className="comparison-grid">
          {/* Wizard Option */}
          <div className="interface-option wizard-option">
            <div className="option-header">
              <div className="option-icon">🧙‍♂️</div>
              <h4>Project Wizard</h4>
              <div className="option-badge recommended">Recommended</div>
            </div>
            
            <div className="option-description">
              Perfect for guided project creation with intelligent assistance
            </div>
            
            <div className="option-features">
              <div className="feature-group">
                <h5>✨ Enhanced Features</h5>
                <ul>
                  <li>Step-by-step guidance</li>
                  <li>Auto-save & draft recovery</li>
                  <li>Smart field suggestions</li>
                  <li>Real-time preview</li>
                  <li>Enhanced validation</li>
                </ul>
              </div>
              
              <div className="feature-group">
                <h5>🎯 Best For</h5>
                <ul>
                  <li>New users</li>
                  <li>Guided workflows</li>
                  <li>Error prevention</li>
                  <li>Modern interface</li>
                </ul>
              </div>
            </div>
            
            <button 
              className="select-option-btn wizard-btn"
              onClick={() => handleInterfaceSelection('wizard', true)}
            >
              Choose Wizard
            </button>
          </div>
          
          {/* Classic Option */}
          <div className="interface-option classic-option">
            <div className="option-header">
              <div className="option-icon">📝</div>
              <h4>Classic Form</h4>
              <div className="option-badge">Traditional</div>
            </div>
            
            <div className="option-description">
              Familiar single-page form for experienced users
            </div>
            
            <div className="option-features">
              <div className="feature-group">
                <h5>⚡ Core Features</h5>
                <ul>
                  <li>Single-page interface</li>
                  <li>All fields visible</li>
                  <li>Quick data entry</li>
                  <li>Familiar workflow</li>
                  <li>Keyboard shortcuts</li>
                </ul>
              </div>
              
              <div className="feature-group">
                <h5>🎯 Best For</h5>
                <ul>
                  <li>Experienced users</li>
                  <li>Quick entry</li>
                  <li>Existing workflows</li>
                  <li>Power users</li>
                </ul>
              </div>
            </div>
            
            <button 
              className="select-option-btn classic-btn"
              onClick={() => handleInterfaceSelection('classic', true)}
            >
              Choose Classic
            </button>
          </div>
        </div>
        
        <div className="selection-options">
          <div className="temporary-choice">
            <p>Want to try before deciding?</p>
            <div className="temp-buttons">
              <button 
                className="temp-btn wizard-temp"
                onClick={() => handleInterfaceSelection('wizard', false)}
              >
                Try Wizard Once
              </button>
              <button 
                className="temp-btn classic-temp"
                onClick={() => handleInterfaceSelection('classic', false)}
              >
                Continue with Classic
              </button>
            </div>
          </div>
          
          <div className="advanced-toggle">
            <button 
              className="advanced-btn"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>
        </div>
        
        {showAdvancedOptions && (
          <div className="advanced-options">
            <h4>Advanced Configuration</h4>
            <div className="advanced-grid">
              <label className="advanced-option">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    featureFlagService.setUserOverride(
                      'wizard-keyboard-shortcuts', 
                      e.target.checked, 
                      'user-preference'
                    );
                  }}
                />
                Enable keyboard shortcuts in wizard
              </label>
              
              <label className="advanced-option">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    featureFlagService.setUserOverride(
                      'enhanced-notifications', 
                      e.target.checked, 
                      'user-preference'
                    );
                  }}
                />
                Enable enhanced notifications
              </label>
              
              <label className="advanced-option">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    featureFlagService.setUserOverride(
                      'smart-defaults-system', 
                      e.target.checked, 
                      'user-preference'
                    );
                  }}
                />
                Enable smart defaults learning
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="migration-assistant-overlay">
      <div className="migration-assistant">
        <div className="assistant-header">
          <h2>Welcome to Enhanced Project Creator</h2>
          <button className="close-btn" onClick={onClose}>×</button>
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
            {currentStep < tutorialSteps.length 
              ? `Step ${currentStep + 1} of ${tutorialSteps.length + 1}`
              : 'Choose Your Experience'
            }
          </div>
        </div>
        
        {/* Content */}
        <div className="assistant-content">
          {currentStep < tutorialSteps.length ? renderTutorialStep() : renderInterfaceComparison()}
        </div>
        
        {/* Navigation */}
        <div className="assistant-navigation">
          {currentStep < tutorialSteps.length ? (
            <>
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
                <button className="nav-btn primary" onClick={handleNext}>
                  {currentStep === tutorialSteps.length - 1 ? 'Choose Interface →' : 'Next →'}
                </button>
              </div>
            </>
          ) : (
            <div className="interface-nav">
              <button 
                className="nav-btn secondary" 
                onClick={() => setCurrentStep(tutorialSteps.length - 1)}
              >
                ← Back to Tutorial
              </button>
              
              <div className="nav-center">
                <span className="selection-hint">
                  💡 You can always change this later in settings
                </span>
              </div>
              
              <button className="nav-btn tertiary" onClick={onClose}>
                Skip for Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationAssistant;
