import React, { useState, useEffect } from 'react';
import TriageCalculatorModal from './TriageCalculatorModal';
import NotificationToast from './NotificationToast';

/**
 * ProjectDetails - Read-only display of project information
 * Shows all project details in a well-organized, read-only format
 */
const ProjectDetails = ({ project, onEdit, onProjectUpdate }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showTriageModal, setShowTriageModal] = useState(false);

  // Debug: Log whenever ProjectDetails receives new props
  useEffect(() => {
    console.log('🔍 ProjectDetails: Received project prop');
    console.log('🔍 ProjectDetails: Project ID:', project?.id);
    console.log('🔍 ProjectDetails: Project ECD:', project?.ecd);
    console.log('🔍 ProjectDetails: Project updatedAt:', project?.updatedAt);
  }, [project]);

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setNotification({
      id: Date.now(),
      message,
      type
    });
  };

  // Clear notification
  const clearNotification = () => {
    setNotification(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    // Use UTC to avoid timezone offset issues
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const formatCurrency = (value) => {
    if (!value) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Helper function to map frontend project data to backend expected format
  // This fixes the field name mismatch where frontend uses 'totalTriage' but backend expects 'totalTime'
  const mapProjectDataForExport = (project) => {
    return {
      // Basic project info
      projectName: project.projectName,
      rfaNumber: project.rfaNumber,
      agentNumber: project.agentNumber,
      projectContainer: project.projectContainer,
      rfaType: project.rfaType,
      isRevision: project.isRevision,
      requestedDate: project.requestedDate,
      estimatedCompletionDate: project.ecd,
      dueDate: project.dueDate,
      
      // Triage data - map frontend field names to backend expected names
      totalTime: project.totalTriage || 0,  // KEY FIX: totalTriage → totalTime
      numOfRooms: project.numOfRooms || 0,
      overrideRooms: project.overrideRooms || 0,
      numOfSubRooms: project.numOfSubRooms || 0,
      overrideSubRooms: project.overrideSubRooms || 0,
      reviewSetup: project.reviewSetup || 0,
      specReview: project.specReview || 0,
      soo: project.soo || 0,
      selfQC: project.selfQC || 0,
      fluff: project.fluff || 0,
      panelTime: project.panelTime || 0,
      layoutTime: project.layoutTime || 0,
      submittalTime: project.submittalTime || 0,
      panelSchedules: project.hasPanelSchedules || false,
      firstAvailable: project.firstAvailable || false,
      
      // Include multipliers that backend might need for calculations
      roomMultiplier: project.roomMultiplier || 2,
      riserMultiplier: project.riserMultiplier || 1,
      
      // Panel data
      largeLMPs: project.largeLMPs || 0,
      mediumLMPs: project.mediumLMPs || 0,
      smallLMPs: project.smallLMPs || 0,
      arp8: project.arp8 || 0,
      arp16: project.arp16 || 0,
      arp32: project.arp32 || 0,
      arp48: project.arp48 || 0,
      esheetsSchedules: project.esheetsSchedules || 2
    };
  };

  // Export to DAS Board
  const handleExportToDASBoard = async () => {
    if (!project.rfaNumber || !project.projectName) {
      showToast('Project must have RFA Number and Project Name to export to DAS Board.', 'error');
      return;
    }

    console.log('📊 ProjectDetails: Exporting to DAS Board');
    console.log('📊 ProjectDetails: Current project ECD:', project.ecd);
    console.log('📊 ProjectDetails: Project object:', project);

    setIsExporting(true);
    try {
      // Map project data to format expected by backend
      const mappedProjectData = mapProjectDataForExport(project);
      const mappedTriageData = mapProjectDataForExport(project);
      
      console.log('📊 ProjectDetails: Mapped data ECD:', mappedProjectData.estimatedCompletionDate);
      
      const result = await window.electronAPI.exportDASBoard(mappedProjectData, mappedTriageData);
      
      if (result.success) {
        console.log('📊 ProjectDetails: Export result:', result.data);
        // Copy to clipboard - format the data as needed for DAS Board
        const exportText = `${result.data.firstColumn}\t${result.data.projectName}\t${result.data.dueDate}\t${result.data.triageTime}`;
        
        await navigator.clipboard.writeText(exportText);
        showToast('✓ Copied to DAS Board format!', 'success');
      } else {
        showToast(`Failed to export to DAS Board: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Export to DAS Board failed:', error);
      showToast('Failed to export to DAS Board.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Agile
  const handleExportToAgile = async () => {
    setIsExporting(true);
    try {
      // Map project data to format expected by backend
      const mappedProjectData = mapProjectDataForExport(project);
      const mappedTriageData = mapProjectDataForExport(project);
      
      const result = await window.electronAPI.exportAgile(mappedProjectData, mappedTriageData);
      
      if (result.success && result.data) {
        // Format the data for Agile - convert object array to tab-separated text
        const exportLines = result.data.map(item => {
          if (typeof item === 'object' && item.label !== undefined) {
            return `${item.label}\t${item.value}`;
          }
          return item;
        });
        const exportText = exportLines.join('\n');
        
        await navigator.clipboard.writeText(exportText);
        showToast('✓ Copied to Agile format!', 'success');
      } else {
        showToast(`Failed to export to Agile: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Export to Agile failed:', error);
      showToast('Failed to export to Agile.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy dates to clipboard
  const handleCopyDates = async () => {
    try {
      // Format dates as MM/DD using UTC to avoid timezone issues
      const formatDateToMMDD = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        // Use UTC methods to avoid timezone offset issues
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${month}/${day}`;
      };

      const ecdFormatted = formatDateToMMDD(project.ecd);
      const requestedDateFormatted = formatDateToMMDD(project.requestedDate);
      
      const datesText = `ECD ${ecdFormatted} - RD ${requestedDateFormatted}`;
      
      await navigator.clipboard.writeText(datesText);
      showToast('✓ Dates copied!', 'success');
    } catch (error) {
      console.error('Copy dates failed:', error);
      showToast('Failed to copy dates.', 'error');
    }
  };

  // Copy project notes to clipboard
  const handleCopyNotes = async () => {
    try {
      if (project.projectNotes) {
        await navigator.clipboard.writeText(project.projectNotes);
        showToast('✓ Notes copied!', 'success');
      }
    } catch (error) {
      console.error('Copy notes failed:', error);
      showToast('Failed to copy notes.', 'error');
    }
  };

  // Handle triage recalculation
  const handleTriageSave = async (updatedProjectData) => {
    try {
      // Call the parent's update handler with new triage data
      if (onProjectUpdate) {
        await onProjectUpdate({
          ...project,
          ...updatedProjectData,
          updatedAt: new Date().toISOString()
        });
      }
      
      setShowTriageModal(false);
      showToast('✓ Triage updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update triage:', error);
      showToast('Failed to update triage. Please try again.', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 h-full overflow-y-auto custom-scrollbar">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-[10000] min-w-[300px] max-w-md">
          <NotificationToast
            notification={notification}
            onClose={clearNotification}
            duration={3000}
          />
        </div>
      )}

      {/* Project Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">📋 Project Overview</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleCopyDates}
              className="btn-outline-primary btn-sm"
              title="Copy ECD and Requested Date to clipboard"
            >
              📅 Copy Dates
            </button>
            <button 
              onClick={handleExportToDASBoard}
              disabled={isExporting || !project.rfaNumber || !project.projectName}
              className="btn-outline-primary btn-sm"
              title="Export project data to DAS Board format"
            >
              📊 Copy to DAS Board
            </button>
            <button 
              onClick={handleExportToAgile}
              disabled={isExporting}
              className="btn-outline-primary btn-sm"
              title="Export triage breakdown to Agile format"
            >
              📈 Copy to Agile
            </button>
            <button onClick={onEdit} className="btn btn-outline btn-small">
              ✏️ Edit
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Name</label>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.projectName || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Number</label>
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{project.rfaNumber || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Agent Number</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.agentNumber || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Container</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectContainer || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Type</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.rfaType || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Regional Team</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.regionalTeam || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">National Account</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.nationalAccount || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border-2 border-primary-500 dark:border-primary-700">
            <label className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">Status</label>
            <span className={`text-sm font-bold ${project.status?.toLowerCase() === 'completed' ? 'text-success-600 dark:text-success-400' : project.status?.toLowerCase() === 'on hold' ? 'text-warning-600 dark:text-warning-400' : 'text-primary-600 dark:text-primary-400'}`}>
              {project.status || 'Active'}
            </span>
          </div>
          
          {project.projectNotes && (
            <div className="detail-item detail-item-full">
              <label>Project Notes</label>
              <div className="col-span-full">
                <span className="project-notes">{project.projectNotes}</span>
                <button 
                  onClick={handleCopyNotes}
                  className="copy-notes-btn"
                  title="Copy notes to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📊 Project Details</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Complexity</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.complexity || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Value</label>
            <span className="text-sm font-bold text-success-600 dark:text-success-400">{formatCurrency(project.rfaValue)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Products</label>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(project.products) && project.products.length > 0 ? (
                project.products.map((product, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-md border border-primary-200 dark:border-primary-700"
                  >
                    {product}
                  </span>
                ))
              ) : (
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {typeof project.products === 'string' && project.products ? project.products : 'Not specified'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Assigned To</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.assignedTo || 'Unassigned'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Rep Contacts</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.repContacts || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">First Available</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.firstAvailable ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📅 Important Dates</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ECD</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.ecd)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Requested Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.requestedDate)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Submitted Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.submittedDate)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Due Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.dueDate)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Created</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.createdAt)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Last Updated</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Triage Information */}
      {(project.totalTriage > 0 || project.hasPanelSchedules || project.hasSubmittals) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🧮 Triage Information</h2>
            <button 
              onClick={() => setShowTriageModal(true)}
              className="btn-outline-primary btn-sm"
              title="Recalculate triage time"
            >
              ✏️ Edit Triage
            </button>
          </div>
          
          {/* Total Triage - Prominent Display */}
          <div className="mb-6 p-5 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border-2 border-primary-500 dark:border-primary-700">
            <label className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">Total Triage Time</label>
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">{project.totalTriage || 0} hours</div>
          </div>
          
          {/* Time Breakdown */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">⏱️ Time Breakdown</h3>
            <div className="grid grid-cols-3 gap-4 2xl:grid-cols-5 lg:grid-cols-2 md:grid-cols-1">
                {project.panelTime > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Panel Time</label>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.panelTime} hr</span>
                  </div>
                )}
                {project.layoutTime > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Layout Time</label>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.layoutTime} hr</span>
                  </div>
                )}
                {project.submittalTime > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Submittal Time</label>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.submittalTime} hr</span>
                  </div>
                )}
                {project.selfQC > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Self QC</label>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.selfQC} hr</span>
                  </div>
                )}
                {project.fluff > 0 && (
                  <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Fluff</label>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.fluff} hr</span>
                  </div>
                )}
              </div>
          </div>

          {/* Configuration */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">⚙️ Configuration</h3>
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-2 md:grid-cols-1">
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Panel Schedules</label>
                <span className={`text-sm font-bold ${project.hasPanelSchedules ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {project.hasPanelSchedules ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Submittal Section</label>
                <span className={`text-sm font-bold ${project.hasSubmittals ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {project.hasSubmittals ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              {project.hasSubmittals && (
                <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Needs Layout/BOM</label>
                  <span className={`text-sm font-bold ${project.needsLayoutBOM ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {project.needsLayoutBOM ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel Schedule Details */}
      {project.hasPanelSchedules && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">⚡ Panel Schedule Details</h2>
          
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">LMPs</h3>
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-2 md:grid-cols-1">
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Large</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.largeLMPs || 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Medium</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.mediumLMPs || 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Small</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.smallLMPs || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">nLight ARPs</h3>
            <div className="grid grid-cols-4 gap-4 lg:grid-cols-2 md:grid-cols-1">
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ARP 8</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.arp8 || 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ARP 16</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.arp16 || 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ARP 32</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.arp32 || 0}</span>
              </div>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ARP 48</label>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.arp48 || 0}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">E-Sheets</h3>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Panel Schedules on E-Sheets</label>
              <span className={`text-sm font-bold ${project.esheetsSchedules === 1 ? 'text-success-600 dark:text-success-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {project.esheetsSchedules === 1 ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Layout Details */}
      {(!project.hasSubmittals || (project.hasSubmittals && project.needsLayoutBOM)) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📐 Layout Details</h2>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Number of Rooms</label>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.numOfRooms || 0}</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Room Multiplier</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.roomMultiplier || 2} min/room</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Override Rooms</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.overrideRooms || 0} hr</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Review/Setup Time</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.reviewSetup || 0} hr</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Number of Pages</label>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.numOfPages || 1}</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Spec Review</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.specReview || 0} hr</span>
            </div>
          </div>
        </div>
      )}

      {/* Submittal Details */}
      {project.hasSubmittals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📝 Submittal Details</h2>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Number of Rooms</label>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.numOfSubRooms || 0}</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Riser Multiplier</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.riserMultiplier || 1} min/room</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Override Submittal Rooms</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.overrideSubRooms || 0} hr</span>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sequence of Operation</label>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.soo || 0} hr</span>
            </div>
          </div>
        </div>
      )}

      {/* Photometrics */}
      {project.showPhotometrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">💡 Photometrics</h2>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Photo Software</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.photoSoftware || 'Not specified'}</span>
          </div>
        </div>
      )}

      {/* Additional Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">⚙️ Additional Settings</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Save Location</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.saveLocation || 'Server'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Is Revision</label>
            <span className={`text-sm font-bold ${project.isRevision ? 'text-warning-600 dark:text-warning-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {project.isRevision ? '✓ Yes' : '✗ No'}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Source</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.sourceType === 'wizard' ? 'Project Wizard' : 'Classic Form'}</span>
          </div>
        </div>
      </div>

      {/* Triage Calculator Modal */}
      <TriageCalculatorModal
        isOpen={showTriageModal}
        project={project}
        onSave={handleTriageSave}
        onCancel={() => setShowTriageModal(false)}
      />
    </div>
  );
};

export default ProjectDetails;
