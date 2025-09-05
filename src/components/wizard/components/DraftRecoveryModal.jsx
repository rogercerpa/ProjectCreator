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
    <div className="modal-overlay" onClick={onClose}>
      <div className="draft-recovery-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 Draft Recovery</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Statistics Section */}
        {stats && (
          <div className="draft-stats">
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">{stats.totalDrafts}</span>
                <span className="stat-label">Total Drafts</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.totalProjects}</span>
                <span className="stat-label">Projects</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.averageCompletion}%</span>
                <span className="stat-label">Avg Completion</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.draftsByStatus.draft}</span>
                <span className="stat-label">In Progress</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Sorting */}
        <div className="draft-controls">
          <div className="filter-section">
            <label>Filter:</label>
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Drafts</option>
              <option value="recent">Recent (24h)</option>
              <option value="step1">Step 1 Only</option>
              <option value="step2">Step 2 Only</option>
            </select>
          </div>
          
          <div className="sort-section">
            <label>Sort by:</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="completion">Completion %</option>
            </select>
          </div>
        </div>

        {/* Draft List */}
        <div className="drafts-container">
          {isLoading ? (
            <div className="loading-drafts">
              <div className="spinner"></div>
              <p>Loading drafts...</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="no-drafts">
              <div className="no-drafts-icon">📝</div>
              <h3>No Drafts Found</h3>
              <p>
                {filter === 'all' 
                  ? "You don't have any saved drafts yet. Start a new project to create your first draft!"
                  : `No drafts match the current filter "${filter}". Try changing the filter or create a new project.`
                }
              </p>
            </div>
          ) : (
            <div className="drafts-grid">
              {filteredDrafts.map(draft => (
                <div 
                  key={draft.id} 
                  className={`draft-card ${selectedDraft?.id === draft.id ? 'selected' : ''}`}
                  onClick={() => setSelectedDraft(draft)}
                >
                  <div className="draft-header">
                    <h4 className="draft-title">
                      {draft.formData.projectName || 'Untitled Project'}
                    </h4>
                    <div className="draft-step">
                      Step {draft.currentStep}
                    </div>
                  </div>

                  <div className="draft-info">
                    <div className="info-row">
                      <span className="info-label">RFA:</span>
                      <span className="info-value">{draft.formData.rfaNumber || 'Not set'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Type:</span>
                      <span className="info-value">{draft.formData.rfaType || 'Not selected'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Team:</span>
                      <span className="info-value">{draft.formData.regionalTeam || 'Not assigned'}</span>
                    </div>
                  </div>

                  <div className="draft-progress">
                    <div className="progress-header">
                      <span>Progress: {draft.completionPercentage}%</span>
                      <span className="current-step">{getStepName(draft.currentStep)}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${draft.completionPercentage}%`,
                          backgroundColor: getCompletionColor(draft.completionPercentage)
                        }}
                      />
                    </div>
                  </div>

                  <div className="draft-meta">
                    <span className="draft-date">{formatDate(draft.metadata.savedAt)}</span>
                    <span className="draft-status">
                      {draft.status === 'completed' ? '✅ Completed' : '🔄 In Progress'}
                    </span>
                  </div>

                  <div className="draft-actions">
                    <button 
                      className="btn btn-primary btn-small"
                      onClick={e => {
                        e.stopPropagation();
                        handleResumeDraft(draft);
                      }}
                    >
                      Resume
                    </button>
                    <button 
                      className="btn btn-danger btn-small"
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
          <div className="selected-draft-preview">
            <h4>Draft Details</h4>
            <div className="preview-content">
              <div className="preview-section">
                <h5>Project Information</h5>
                <div className="preview-grid">
                  <div><strong>Name:</strong> {selectedDraft.formData.projectName || 'Not set'}</div>
                  <div><strong>RFA:</strong> {selectedDraft.formData.rfaNumber || 'Not set'}</div>
                  <div><strong>Agent:</strong> {selectedDraft.formData.agentNumber || 'Not set'}</div>
                  <div><strong>Container:</strong> {selectedDraft.formData.projectContainer || 'Not set'}</div>
                </div>
              </div>
              
              {selectedDraft.currentStep >= 2 && (
                <div className="preview-section">
                  <h5>Triage Information</h5>
                  <div className="preview-grid">
                    <div><strong>Panel Schedules:</strong> {selectedDraft.formData.hasPanelSchedules ? 'Yes' : 'No'}</div>
                    <div><strong>Submittals:</strong> {selectedDraft.formData.hasSubmittals ? 'Yes' : 'No'}</div>
                    <div><strong>Total Triage:</strong> {selectedDraft.formData.totalTriage || 0} hours</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {selectedDraft && (
            <button 
              className="btn btn-primary"
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


