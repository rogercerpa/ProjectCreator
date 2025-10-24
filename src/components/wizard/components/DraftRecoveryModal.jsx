import React, { useState, useEffect } from 'react';

/**
 * DraftRecoveryModal - Enhanced draft recovery system
 * Shows incomplete projects and allows users to resume or delete drafts
 */
const DraftRecoveryModal = ({ 
  isOpen, 
  onClose, 
  onResumeDraft, 
  onDeleteDraft,
  draftService 
}) => {
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // all, step1, step2, recent
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, completion

  // Load drafts when modal opens
  useEffect(() => {
    if (isOpen && draftService) {
      loadDrafts();
      loadStats();
    }
  }, [isOpen, draftService]);

  const loadDrafts = async () => {
    setIsLoading(true);
    try {
      const allDrafts = await draftService.getAllDrafts();
      setDrafts(allDrafts);
    } catch (error) {
      console.error('Error loading drafts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statistics = await draftService.getDraftStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleResumeDraft = async (draft) => {
    if (onResumeDraft) {
      onResumeDraft(draft);
      onClose();
    }
  };

  const handleDeleteDraft = async (draftId) => {
    if (window.confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      try {
        await draftService.deleteDraft(draftId);
        await loadDrafts();
        await loadStats();
        setSelectedDraft(null);
        
        if (onDeleteDraft) {
          onDeleteDraft(draftId);
        }
      } catch (error) {
        console.error('Error deleting draft:', error);
      }
    }
  };

  const getFilteredAndSortedDrafts = () => {
    let filtered = drafts.filter(draft => {
      if (filter === 'step1') return draft.currentStep === 1;
      if (filter === 'step2') return draft.currentStep === 2;
      if (filter === 'recent') {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return new Date(draft.metadata.savedAt) > oneDayAgo;
      }
      return true; // 'all'
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.metadata.savedAt) - new Date(b.metadata.savedAt);
      }
      if (sortBy === 'completion') {
        return b.completionPercentage - a.completionPercentage;
      }
      // Default: newest first
      return new Date(b.metadata.savedAt) - new Date(a.metadata.savedAt);
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getStepName = (step) => {
    const stepNames = {
      1: 'Basic Information',
      2: 'Triage Calculation',
      3: 'Project Management'
    };
    return stepNames[step] || `Step ${step}`;
  };

  const getCompletionColor = (percentage) => {
    if (percentage < 25) return '#f44336';
    if (percentage < 50) return '#ff9800';
    if (percentage < 75) return '#2196f3';
    return '#4caf50';
  };

  if (!isOpen) return null;

  const filteredDrafts = getFilteredAndSortedDrafts();

  return (
    <div className="modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content max-w-6xl w-[95%] max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 relative">
          <h2 className="m-0 text-2xl font-bold text-gray-800 dark:text-gray-100">📋 Draft Recovery</h2>
          <button 
            className="absolute top-4 right-4 bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Statistics Section */}
        {stats && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
                <span className="block text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.totalDrafts}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400 mt-1">Total Drafts</span>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
                <span className="block text-3xl font-bold text-info-600 dark:text-info-400">{stats.totalProjects}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400 mt-1">Projects</span>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
                <span className="block text-3xl font-bold text-success-600 dark:text-success-400">{stats.averageCompletion}%</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400 mt-1">Avg Completion</span>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
                <span className="block text-3xl font-bold text-warning-600 dark:text-warning-400">{stats.draftsByStatus.draft}</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400 mt-1">In Progress</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="px-6 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Drafts</option>
              <option value="recent">Recent (24h)</option>
              <option value="step1">Step 1 Only</option>
              <option value="step2">Step 2 Only</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="completion">Completion %</option>
            </select>
          </div>
        </div>

        {/* Draft List */}
        <div className="px-6 py-5 max-h-[calc(90vh-400px)] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="spinner mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading drafts...</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="m-0 mb-2 text-xl font-semibold text-gray-800 dark:text-gray-200">No Drafts Found</h3>
              <p className="m-0 text-gray-600 dark:text-gray-400 max-w-md">
                {filter === 'all' 
                  ? "You don't have any saved drafts yet. Start a new project to create your first draft!"
                  : `No drafts match the current filter "${filter}". Try changing the filter or create a new project.`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrafts.map(draft => (
                <div 
                  key={draft.id} 
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                    selectedDraft?.id === draft.id 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                  onClick={() => setSelectedDraft(draft)}
                >
                  {/* Draft Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="m-0 text-base font-semibold text-gray-800 dark:text-gray-100 flex-1 pr-2 line-clamp-2">
                      {draft.formData.projectName || 'Untitled Project'}
                    </h4>
                    <div className="flex-shrink-0 px-2 py-1 bg-primary-600 text-white text-xs font-bold rounded">
                      Step {draft.currentStep}
                    </div>
                  </div>

                  {/* Draft Info */}
                  <div className="mb-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">RFA:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{draft.formData.rfaNumber || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{draft.formData.rfaType || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Team:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{draft.formData.regionalTeam || 'Not assigned'}</span>
                    </div>
                  </div>

                  {/* Draft Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Progress: {draft.completionPercentage}%</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{getStepName(draft.currentStep)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all"
                        style={{ 
                          width: `${draft.completionPercentage}%`,
                          backgroundColor: getCompletionColor(draft.completionPercentage)
                        }}
                      />
                    </div>
                  </div>

                  {/* Draft Meta */}
                  <div className="flex justify-between items-center mb-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{formatDate(draft.metadata.savedAt)}</span>
                    <span className={`font-medium ${
                      draft.status === 'completed' ? 'text-success-600 dark:text-success-400' : 'text-info-600 dark:text-info-400'
                    }`}>
                      {draft.status === 'completed' ? '✅ Completed' : '🔄 In Progress'}
                    </span>
                  </div>

                  {/* Draft Actions */}
                  <div className="flex gap-2">
                    <button 
                      className="flex-1 px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        handleResumeDraft(draft);
                      }}
                    >
                      Resume
                    </button>
                    <button 
                      className="flex-1 px-3 py-1.5 text-sm font-medium bg-error-600 hover:bg-error-700 text-white rounded transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteDraft(draft.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Draft Preview */}
        {selectedDraft && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <h4 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">Draft Details</h4>
            <div className="space-y-3">
              <div>
                <h5 className="m-0 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Project Information</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600 dark:text-gray-400"><strong>Name:</strong> {selectedDraft.formData.projectName || 'Not set'}</div>
                  <div className="text-gray-600 dark:text-gray-400"><strong>RFA:</strong> {selectedDraft.formData.rfaNumber || 'Not set'}</div>
                  <div className="text-gray-600 dark:text-gray-400"><strong>Agent:</strong> {selectedDraft.formData.agentNumber || 'Not set'}</div>
                  <div className="text-gray-600 dark:text-gray-400"><strong>Container:</strong> {selectedDraft.formData.projectContainer || 'Not set'}</div>
                </div>
              </div>
              
              {selectedDraft.currentStep >= 2 && (
                <div>
                  <h5 className="m-0 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Triage Information</h5>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-gray-600 dark:text-gray-400"><strong>Panel Schedules:</strong> {selectedDraft.formData.hasPanelSchedules ? 'Yes' : 'No'}</div>
                    <div className="text-gray-600 dark:text-gray-400"><strong>Submittals:</strong> {selectedDraft.formData.hasSubmittals ? 'Yes' : 'No'}</div>
                    <div className="text-gray-600 dark:text-gray-400"><strong>Total Triage:</strong> {selectedDraft.formData.totalTriage || 0} hours</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {selectedDraft && (
            <button 
              className="btn-primary"
              onClick={() => handleResumeDraft(selectedDraft)}
            >
              Resume Selected Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftRecoveryModal;


