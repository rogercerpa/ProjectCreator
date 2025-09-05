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
    <div className={`wizard-layout ${className}`}>
      <div className="wizard-header">
        {/* Step Info */}
        <div className="step-info">
          <div className="step-badge">
            <span className="step-badge-number">{step}</span>
            <span className="step-badge-divider">of</span>
            <span className="step-badge-total">{totalSteps}</span>
          </div>
          
          <h2 className="step-title">{title}</h2>
          {subtitle && <p className="step-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="wizard-content">
        {children}
      </div>
    </div>
  );
};

export default WizardLayout;


