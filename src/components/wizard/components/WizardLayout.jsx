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
  actions,
  className = ''
}) => {
  return (
    <div className={`max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-fadeIn ${className}`}>
      {/* Compact Hero Header with Gradient */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 dark:from-primary-700 dark:via-primary-800 dark:to-secondary-800 px-6 py-8 sm:px-8 sm:py-12">
        {/* Modern Mesh Background Elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-secondary-400/20 blur-3xl animate-float"></div>

        <div className="relative z-10">
          {/* Top Row: Step Badge, Progress, and Actions */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {/* Step Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-sm">
                <span className="text-white font-bold text-sm">Step {step}</span>
                <span className="text-white/70 text-xs font-medium">of</span>
                <span className="text-white font-semibold text-sm">{totalSteps}</span>
              </div>
              
              {/* Mini Progress Bar */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-md border border-white/10">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white font-bold tracking-wider">{Math.round((step / totalSteps) * 100)}%</span>
              </div>
            </div>

            {/* Injected Step Actions */}
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </div>

          {/* Title and Subtitle */}
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 text-balance">
              {title}
            </h2>
            {subtitle && (
              <p className="text-base sm:text-lg text-primary-50 opacity-90 leading-relaxed text-balance font-light">
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


