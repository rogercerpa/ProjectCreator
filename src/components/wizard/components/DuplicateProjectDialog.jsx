import React from 'react';

/**
 * DuplicateProjectDialog - Warning dialog for duplicate project detection
 * Shows when an existing project is found and guides user toward correct workflow
 */
const DuplicateProjectDialog = ({ 
  isOpen, 
  warningData, 
  onCreateRevision, 
  onProceedAnyway, 
  onCancel 
}) => {
  if (!isOpen || !warningData) {
    return null;
  }

  const handleCreateRevision = () => {
    console.log('🔄 User chose to create revision');
    onCreateRevision(warningData);
  };

  const handleProceedAnyway = () => {
    console.log('⚠️ User chose to proceed with new project anyway');
    onProceedAnyway();
  };

  const handleCancel = () => {
    console.log('❌ User cancelled - will ask agent to resubmit');
    onCancel();
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString.length !== 8) return dateString;
    
    const month = dateString.substring(0, 2);
    const day = dateString.substring(2, 4);
    const year = dateString.substring(4, 8);
    
    return `${month}/${day}/${year}`;
  };

  return (
    <div className="modal-overlay backdrop-blur-sm">
      <div className="modal-content border-2 border-warning-500 dark:border-warning-600 min-w-[500px] max-w-[700px]">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b-2 border-warning-200 dark:border-warning-800 bg-gradient-to-r from-warning-50 to-warning-100 dark:from-warning-900/30 dark:to-warning-800/30">
          <div className="text-4xl animate-pulse-soft">⚠️</div>
          <h2 className="m-0 text-warning-800 dark:text-warning-200 text-2xl font-bold uppercase tracking-wide">
            DUPLICATE PROJECT DETECTED
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Project Info */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Project: <span className="text-primary-600 dark:text-primary-400 font-bold">
                {warningData.projectName || 'Unknown Project'}
              </span>
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              A project folder already exists for this project.
            </p>
          </div>

          {/* Simple Message */}
          <div className="bg-warning-50 dark:bg-warning-900/20 border-l-4 border-warning-500 p-4 rounded">
            <p className="text-gray-800 dark:text-gray-200 mb-2 leading-relaxed">
              🚨 <strong>An existing project folder was found.</strong>
            </p>
            <p className="text-gray-700 dark:text-gray-300 m-0 leading-relaxed">
              The agent may have intended to submit a <strong>revision request</strong> instead of a new project.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
          <button 
            className="px-5 py-3 bg-warning-500 text-white border-none rounded-lg font-semibold cursor-pointer transition-all hover:bg-warning-600 hover:-translate-y-0.5 shadow-md hover:shadow-lg"
            onClick={handleProceedAnyway}
            title="Continue with new project creation"
          >
            ⚠️ Proceed with New Project
          </button>
          
          <button 
            className="btn-secondary"
            onClick={handleCancel}
            title="Cancel and clear form - agent will resubmit"
          >
            ❌ Cancel - Agent Will Resubmit
          </button>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-info-50 dark:bg-info-900/20 border-t border-info-200 dark:border-info-800">
          <p className="text-sm text-info-800 dark:text-info-200 m-0">
            💡 <strong>Tip:</strong> If unsure, cancel and ask the agent to clarify whether this should be a new project or a revision.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DuplicateProjectDialog;
