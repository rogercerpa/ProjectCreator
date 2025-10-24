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
    <div className="p-4">
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {showPercentage && (
          <div className="text-right text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
            {Math.round(progressPercentage)}% Complete
          </div>
        )}
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-start">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          
          return (
            <div
              key={stepNumber}
              className="flex flex-col items-center flex-1"
            >
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all
                ${isActive 
                  ? 'bg-primary-500 text-white scale-110 shadow-primary' 
                  : isCompleted 
                  ? 'bg-success-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }
              `}>
                {isCompleted ? '✓' : stepNumber}
              </div>
              {showStepNames && (
                <div className={`
                  mt-2 text-sm text-center font-medium
                  ${isActive 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-gray-600 dark:text-gray-400'
                  }
                `}>
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
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          const isUpcoming = stepNumber > currentStep;
          
          return (
            <div
              key={stepNumber}
              className="flex items-center gap-4"
            >
              <div className="relative flex flex-col items-center">
                {stepNumber < totalSteps && (
                  <div className={`
                    absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-8
                    ${isCompleted ? 'bg-success-500' : 'bg-gray-300 dark:bg-gray-700'}
                  `} />
                )}
                
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold z-10
                  ${isActive 
                    ? 'bg-primary-500 text-white shadow-primary' 
                    : isCompleted 
                    ? 'bg-success-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }
                `}>
                  {isCompleted ? '✓' : stepNumber}
                </div>
              </div>
              
              <div className="flex-1">
                <div className={`
                  font-semibold
                  ${isActive 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}>
                  {titles[i] || `Step ${stepNumber}`}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {showPercentage && (
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {completedSteps.length} of {totalSteps} steps completed
          </div>
          <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = completedSteps.includes(stepNumber);
          
          return (
            <div
              key={stepNumber}
              className={`
                w-2 h-8 rounded-full transition-all
                ${isActive 
                  ? 'bg-primary-500 w-3' 
                  : isCompleted 
                  ? 'bg-success-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
                }
              `}
            />
          );
        })}
      </div>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
    <div className="inline-flex items-center gap-2">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
        ${isActive 
          ? 'bg-primary-500 text-white' 
          : isCompleted 
          ? 'bg-success-500 text-white' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }
      `}>
        {isCompleted ? '✓' : stepNumber}
      </div>
      {title && (
        <span className={`
          text-sm font-medium
          ${isActive 
            ? 'text-primary-600 dark:text-primary-400' 
            : 'text-gray-700 dark:text-gray-300'
          }
        `}>
          {title}
        </span>
      )}
    </div>
  );
};

export default WizardProgress;


