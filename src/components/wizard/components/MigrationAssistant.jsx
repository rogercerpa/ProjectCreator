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
      <div className="flex flex-col items-center text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="text-6xl mb-4">{step.icon}</div>
          <h3 className="m-0 text-2xl font-bold text-gray-800 dark:text-gray-100">{step.title}</h3>
        </div>
        
        <div className="max-w-2xl">
          <p className="text-base text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{step.content}</p>
          
          {step.features.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-left">
              <h4 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">Key Features:</h4>
              <ul className="list-none m-0 p-0 space-y-2">
                {step.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-success-600 dark:text-success-400 font-bold flex-shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {step.tip && (
            <div className="mt-4 p-3 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700 rounded text-sm text-gray-700 dark:text-gray-300 text-left">
              <p className="m-0">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    );
  };


  if (!isOpen) return null;

  return (
    <div className="modal-overlay backdrop-blur-sm">
      <div className="modal-content max-w-4xl w-[90%] max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 relative">
          <h2 className="m-0 text-2xl font-bold text-gray-800 dark:text-gray-100">Welcome to Project Creator - Quick Tour</h2>
          <button 
            className="absolute top-4 right-4 bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
            onClick={handleSkip}
          >
            ×
          </button>
        </div>
        
        {/* Progress Indicator */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 font-medium">
            Step {currentStep + 1} of {tutorialSteps.length}
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-8 max-h-[calc(85vh-250px)] overflow-y-auto custom-scrollbar">
          {renderTutorialStep()}
        </div>
        
        {/* Navigation */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button className="btn-secondary" onClick={handlePrevious}>
                ← Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-1">
            {tutorialSteps.map((_, index) => (
              <div 
                key={index}
                className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                  index <= currentStep 
                    ? 'bg-primary-600 dark:bg-primary-400 w-8' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={handleSkip}>
              Skip Tutorial
            </button>
            <button className="btn-primary" onClick={handleNext}>
              {currentStep === tutorialSteps.length - 1 ? 'Get Started! 🚀' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationAssistant;
