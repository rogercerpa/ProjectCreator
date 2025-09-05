import React from 'react';

/**
 * Wizard Progress Component
 * Displays visual progress indicator and completion status
 */
const WizardProgress = ({
  currentStep,
  totalSteps,
  completedSteps = [],
  stepTitles = [],
  showPercentage = true,
  showStepNames = true,
  variant = 'horizontal' // 'horizontal' or 'vertical'
}) => {
  // Calculate progress percentage
  const progressPercentage = (completedSteps.length / totalSteps) * 100;
  
  // Default step titles if not provided
  const defaultStepTitles = [
    'Basic Information',
    'Triage Calculation', 
    'Project Management'
  ];
  
  const titles = stepTitles.length > 0 ? stepTitles : defaultStepTitles;

  const renderHorizontalProgress = () => (
    <div className="wizard-progress horizontal">
      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {showPercentage && (
          <div className="progress-percentage">
            {Math.round(progressPercentage)}% Complete
          </div>
        )}
      </div>

      {/* Step Indicators */}
      <div className="step-indicators">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          
          return (
            <div
              key={stepNumber}
              className={`step-indicator ${
                isActive ? 'active' : ''
              } ${
                isCompleted ? 'completed' : ''
              }`}
            >
              <div className="step-circle">
                {isCompleted ? '✓' : stepNumber}
              </div>
              {showStepNames && (
                <div className="step-name">
                  {titles[i] || `Step ${stepNumber}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderVerticalProgress = () => (
    <div className="wizard-progress vertical">
      <div className="vertical-steps">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          const isUpcoming = stepNumber > currentStep;
          
          return (
            <div
              key={stepNumber}
              className={`vertical-step ${
                isActive ? 'active' : ''
              } ${
                isCompleted ? 'completed' : ''
              } ${
                isUpcoming ? 'upcoming' : ''
              }`}
            >
              <div className="step-connector">
                {stepNumber < totalSteps && (
                  <div className={`connector-line ${
                    isCompleted ? 'completed' : ''
                  }`} />
                )}
              </div>
              
              <div className="step-circle">
                {isCompleted ? '✓' : stepNumber}
              </div>
              
              <div className="step-content">
                <div className="step-title">
                  {titles[i] || `Step ${stepNumber}`}
                </div>
                <div className="step-status">
                  {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {showPercentage && (
        <div className="vertical-progress-summary">
          <div className="progress-text">
            {completedSteps.length} of {totalSteps} steps completed
          </div>
          <div className="progress-percentage">
            {Math.round(progressPercentage)}%
          </div>
        </div>
      )}
    </div>
  );

  return variant === 'vertical' ? renderVerticalProgress() : renderHorizontalProgress();
};

/**
 * Compact Progress Indicator
 * Minimal progress display for tight spaces
 */
export const CompactProgress = ({ 
  currentStep, 
  totalSteps, 
  completedSteps = [] 
}) => {
  const progressPercentage = (completedSteps.length / totalSteps) * 100;
  
  return (
    <div className="compact-progress">
      <div className="compact-steps">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          
          return (
            <div
              key={stepNumber}
              className={`compact-step ${
                isActive ? 'active' : ''
              } ${
                isCompleted ? 'completed' : ''
              }`}
            />
          );
        })}
      </div>
      <div className="compact-text">
        {currentStep}/{totalSteps} ({Math.round(progressPercentage)}%)
      </div>
    </div>
  );
};

/**
 * Step Status Badge
 * Individual step status indicator
 */
export const StepStatusBadge = ({ 
  stepNumber, 
  isActive = false, 
  isCompleted = false, 
  title = '' 
}) => {
  return (
    <div className={`step-status-badge ${
      isActive ? 'active' : ''
    } ${
      isCompleted ? 'completed' : ''
    }`}>
      <div className="badge-circle">
        {isCompleted ? '✓' : stepNumber}
      </div>
      {title && (
        <span className="badge-title">{title}</span>
      )}
    </div>
  );
};

export default WizardProgress;


