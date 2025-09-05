import React from 'react';

/**
 * Wizard Navigation Component
 * Handles wizard step navigation, progress display, and action buttons
 */
const WizardNavigation = ({
  currentStep,
  totalSteps,
  canGoToPrevious,
  canProceedToNext,
  isLoading,
  onPrevious,
  onNext,
  onCancel,
  onComplete,
  onStepClick,
  completedSteps = [],
  accessibleSteps = [],
  customActions = null
}) => {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div className="wizard-navigation">
      {/* Left Side - Previous and Cancel */}
      <div className="nav-left">
        {!isFirstStep && (
          <button
            onClick={onPrevious}
            disabled={!canGoToPrevious || isLoading}
            className="btn btn-secondary"
            type="button"
          >
            ← Previous
          </button>
        )}
        
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="btn btn-outline"
          type="button"
        >
          Cancel
        </button>
      </div>

      {/* Center - Step Progress Indicators */}
      <div className="nav-center">
        <div className="step-progress">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNumber = i + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = completedSteps.includes(stepNumber);
            const isAccessible = accessibleSteps.includes(stepNumber) || stepNumber === 1;
            
            return (
              <div
                key={stepNumber}
                className={`progress-step ${
                  isActive ? 'active' : ''
                } ${
                  isCompleted ? 'completed' : ''
                } ${
                  isAccessible ? 'accessible' : 'disabled'
                }`}
                onClick={() => {
                  if (isAccessible && onStepClick && !isLoading) {
                    onStepClick(stepNumber);
                  }
                }}
                title={`Step ${stepNumber}${isCompleted ? ' (Completed)' : ''}${isActive ? ' (Current)' : ''}`}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>
            );
          })}
        </div>
        
        {/* Progress Text */}
        <div className="progress-text">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      {/* Right Side - Next and Complete */}
      <div className="nav-right">
        {/* Custom Actions */}
        {customActions && (
          <div className="custom-actions">
            {customActions}
          </div>
        )}
        
        {/* Main Action Button */}
        {!isLastStep ? (
          <button
            onClick={onNext}
            disabled={!canProceedToNext || isLoading}
            className="btn btn-primary"
            type="button"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Saving...
              </>
            ) : (
              'Next →'
            )}
          </button>
        ) : (
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="btn btn-primary btn-complete"
            type="button"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Completing...
              </>
            ) : (
              'Complete Project'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default WizardNavigation;


