import React from 'react';

/**
 * Common layout component for wizard steps
 * Provides consistent structure and styling for all steps
 */
const WizardLayout = ({ 
  children, 
  title, 
  subtitle, 
  step, 
  totalSteps,
  className = ''
}) => {
  return (
    <div className={`max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Compact Hero Header with Gradient */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 dark:from-primary-800 dark:via-primary-900 dark:to-secondary-900 px-6 py-8 sm:px-8 sm:py-12">
        {/* Subtle gradient overlays for depth */}
        <div
          aria-hidden="true"
          className="absolute -top-24 right-0 -z-10 transform-gpu blur-3xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-white to-primary-200 opacity-20"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-0 -z-10 transform-gpu blur-3xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-secondary-300 to-primary-300 opacity-20"
          />
        </div>

        <div className="relative z-10">
          {/* Step Badge and Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
              <span className="text-white font-bold text-sm">Step {step}</span>
              <span className="text-white/70 text-xs">of</span>
              <span className="text-white/90 font-semibold text-sm">{totalSteps}</span>
            </div>
            
            {/* Mini Progress Bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/80 font-medium">{Math.round((step / totalSteps) * 100)}%</span>
            </div>
          </div>

          {/* Title and Subtitle */}
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        {children}
      </div>
    </div>
  );
};

export default WizardLayout;


