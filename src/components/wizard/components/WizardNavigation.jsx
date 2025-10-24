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
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
      {/* Left Side - Previous and Cancel */}
      <div className="flex items-center gap-3">
        {!isFirstStep && (
          <button
            onClick={onPrevious}
            disabled={!canGoToPrevious || isLoading}
            className="btn-secondary"
            type="button"
          >
            ← Previous
          </button>
        )}
        
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          type="button"
        >
          Cancel
        </button>
      </div>

      {/* Center - Step Progress Indicators */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNumber = i + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = completedSteps.includes(stepNumber);
            const isAccessible = accessibleSteps.includes(stepNumber) || stepNumber === 1;
            
            return (
              <div
                key={stepNumber}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                  transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'bg-primary-500 text-white scale-110 shadow-primary' 
                    : isCompleted 
                    ? 'bg-success-500 text-white hover:scale-105' 
                    : isAccessible 
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  }
                `}
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
        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Step {currentStep} of {totalSteps}
        </div>
      </div>

      {/* Right Side - Next and Complete */}
      <div className="flex items-center gap-3">
        {/* Custom Actions */}
        {customActions && (
          <div className="flex items-center gap-2">
            {customActions}
          </div>
        )}
        
        {/* Main Action Button */}
        {!isLastStep ? (
          <button
            onClick={onNext}
            disabled={!canProceedToNext || isLoading}
            className="btn-primary min-w-[120px]"
            type="button"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="spinner w-4 h-4 border-2"></span>
                Saving...
              </span>
            ) : (
              'Next →'
            )}
          </button>
        ) : (
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="btn-primary min-w-[160px] bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700"
            type="button"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="spinner w-4 h-4 border-2"></span>
                Completing...
              </span>
            ) : (
              '✓ Complete Project'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default WizardNavigation;


