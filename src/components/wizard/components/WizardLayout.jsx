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
        <div className="step-indicator">
          <span className="step-number">Step {step}</span>
          <span className="step-divider">of</span>
          <span className="total-steps">{totalSteps}</span>
        </div>
        
        <div className="step-info">
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


