import React, { useState, useEffect } from 'react';
import TriageCalculatorModal from './TriageCalculatorModal';
import NotificationToast from './NotificationToast';
import ZipSelectionDialog from './ZipSelectionDialog';
import EmailTemplateEditor from './shared/EmailTemplateEditor';
import { openPaidServicesEmail } from '../utils/emailTemplates';

/**
 * ProjectDetails - Read-only display of project information
 * Shows all project details in a well-organized, read-only format
 */
const ProjectDetails = ({ project, onEdit, onProjectUpdate }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [hasReadyForQCZip, setHasReadyForQCZip] = useState(false);
  const [matchingZipFiles, setMatchingZipFiles] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showZipSelectionDialog, setShowZipSelectionDialog] = useState(false);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  
  // DAS Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ phase: '', progress: 0, message: '' });
  const [showUploadConfirmDialog, setShowUploadConfirmDialog] = useState(false);
  const [uploadConfirmMessage, setUploadConfirmMessage] = useState('');
  
  const hasPaidServices = !!project?.dasPaidServiceEnabled;
  const canSendPaidServiceEmail = hasPaidServices &&
    project?.dasRepEmail &&
    project?.dasCostPerPage &&
    project?.dasLightingPages &&
    project?.dasFee;

  // Debug: Log whenever ProjectDetails receives new props
  useEffect(() => {
    console.log('🔍 ProjectDetails: Received project prop');
    console.log('🔍 ProjectDetails: Project ID:', project?.id);
    console.log('🔍 ProjectDetails: Project ECD:', project?.ecd);
    console.log('🔍 ProjectDetails: Project updatedAt:', project?.updatedAt);
  }, [project]);

  // Check for matching zip files when project loads
  useEffect(() => {
    const checkForZipFiles = async () => {
      if (!project?.id) return;
      
      try {
        const result = await window.electronAPI.qcCheckProject(project.id);
        if (result.success) {
          setHasReadyForQCZip(result.hasZip);
          setMatchingZipFiles(result.zipFiles || []);
        }
      } catch (error) {
        console.error('Error checking for QC zip files:', error);
      }
    };

    checkForZipFiles();
  }, [project?.id]);

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
    // Display in user's local timezone with both date and time
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (value) => {
    if (!value) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const handlePaidServicesEmail = () => {
    const result = openPaidServicesEmail(project);
    if (result.success) {
      showToast('Outlook email drafted with paid services details.');
    } else if (result.missingFields?.length) {
      showToast(`Add ${result.missingFields.join(', ')} to draft the email.`, 'error');
    }
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

  // Handle download folder button click
  const handleDownloadFolder = async () => {
    if (matchingZipFiles.length === 0) {
      showToast('No zip files found for this project.', 'error');
      return;
    }

    // If multiple zip files, show selection dialog
    if (matchingZipFiles.length > 1) {
      setShowZipSelectionDialog(true);
      return;
    }

    // Single zip file - download directly
    await downloadZipFile(matchingZipFiles[0]);
  };

  // Download and extract zip file
  const downloadZipFile = async (zipFile) => {
    setIsDownloading(true);
    setShowZipSelectionDialog(false);

    try {
      const result = await window.electronAPI.qcDownloadZip(zipFile.path, project);
      
      if (result.success) {
        showToast(`✓ Folder downloaded to ${result.extractedPath}`, 'success');
        
        // Update project with download timestamp so Upload button appears
        if (onProjectUpdate) {
          const updatedProject = {
            ...project,
            qcFolderDownloadedAt: new Date().toISOString(),
            qcFolderDownloadedPath: result.extractedPath
          };
          await onProjectUpdate(updatedProject);
        }
      } else {
        showToast(`Failed to download folder: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading zip file:', error);
      showToast('Failed to download folder. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle zip selection from dialog
  const handleZipSelect = async (zipFile) => {
    await downloadZipFile(zipFile);
  };

  // Setup DAS upload progress listener
  useEffect(() => {
    const cleanup = window.electronAPI.onDasUploadProgress((progress) => {
      setUploadProgress(progress);
    });
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Handle DAS upload
  const handleDasUpload = async (confirmed = false) => {
    if (!project?.projectName || !project?.projectContainer) {
      showToast('Project name and container are required for upload.', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ phase: 'checking', progress: 0, message: 'Starting upload...' });

    try {
      const result = await window.electronAPI.dasUploadProject(project, confirmed);

      if (result.needsConfirmation) {
        // Show confirmation dialog
        setUploadConfirmMessage(result.message);
        setShowUploadConfirmDialog(true);
        setIsUploading(false);
        return;
      }

      if (result.success) {
        showToast(`✓ ${result.message}`, 'success');
        
        // Update project with new upload status
        if (result.updatedProject && onProjectUpdate) {
          await onProjectUpdate(result.updatedProject);
        }
      } else {
        showToast(`Upload failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('DAS upload error:', error);
      showToast(`Upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress({ phase: '', progress: 0, message: '' });
    }
  };

  // Handle confirmed upload (after user confirms overwrite)
  const handleConfirmedUpload = async () => {
    setShowUploadConfirmDialog(false);
    await handleDasUpload(true);
  };

  // Determine button visibility
  const hasDownloadedFolder = !!project?.qcFolderDownloadedAt;
  const hasAlreadyUploaded = !!project?.dasUploadStatus?.uploadedAt;
  // Show Download button: has zip file available AND hasn't downloaded yet AND hasn't uploaded yet
  const showDownloadButton = hasReadyForQCZip && !hasDownloadedFolder && !hasAlreadyUploaded;
  // Show Upload button: has downloaded the folder (regardless of RFA status)
  const showUploadButton = hasDownloadedFolder;
  // Hide export buttons when RFA Status is Ready for QC, Completed, On Hold, or Cancelled
  const hideExportStatuses = ['Ready for QC', 'Completed', 'On Hold', 'Cancelled'];
  const showExportButtons = !hideExportStatuses.includes(project?.rfaStatus);

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

      {/* Project Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">📋 Project Info</h2>
          <div className="flex gap-2">
            {showExportButtons && (
              <>
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
              </>
            )}
            {showDownloadButton && (
              <button 
                onClick={handleDownloadFolder}
                disabled={isDownloading}
                className="btn-outline-primary btn-sm"
                title="Download project folder from Ready for QC"
              >
                {isDownloading ? '⏳ Downloading...' : '📥 Download Folder'}
              </button>
            )}
            {showUploadButton && (
              hasAlreadyUploaded ? (
                <button 
                  disabled
                  className="btn-outline-success btn-sm opacity-75 cursor-not-allowed"
                  title={`Uploaded on ${new Date(project.dasUploadStatus.uploadedAt).toLocaleString()}`}
                >
                  ✅ Uploaded to DAS
                </button>
              ) : (
                <button 
                  onClick={() => handleDasUpload(false)}
                  disabled={isUploading}
                  className="btn-primary btn-sm"
                  title="Upload project folder to DAS Drive (Z:)"
                >
                  {isUploading ? '⏳ Uploading...' : '📤 Upload to DAS Drive'}
                </button>
              )
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Name</label>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{project.projectName || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Type</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectType || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Address</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectAddress || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Container</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectContainer || 'Not specified'}</span>
          </div>
          {project.projectNotes && (
            <div className="col-span-full flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Notes</label>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectNotes}</span>
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
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Stage</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.projectStage || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Design Process Phase</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.designProcessPhase || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Buy American or BABA</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.buyAmericanOrBaba ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Folder Save Location</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.saveLocation || 'Server'}</span>
          </div>
        </div>
      </div>

      {/* Agency Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">🏢 Agency Info</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Agency Name</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.agencyName || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Agency Number</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.agentNumber || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Agent Contact</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.repContacts || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Region</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.regionalTeam || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">National Account</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.nationalAccount || 'Not specified'}</span>
          </div>
        </div>
      </div>

      {/* RFA Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📄 RFA Info</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Number</label>
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{project.rfaNumber || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Type</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.rfaType || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Revision Type</label>
            <span className={`text-sm font-bold ${project.isRevision ? 'text-warning-600 dark:text-warning-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {project.isRevision ? 'Revision' : 'New Project'}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Value</label>
            <span className="text-sm font-bold text-success-600 dark:text-success-400">{formatCurrency(project.rfaValue)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Status</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.rfaStatus || 'Not specified'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">RFA Complexity</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.rfaComplexity || 'Not specified'}</span>
          </div>
          {project.dasUploadStatus?.uploadedAt && (
            <div className="flex flex-col gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-700">
              <label className="text-xs font-semibold text-success-700 dark:text-success-400 uppercase tracking-wide">DAS Upload Status</label>
              <div className="flex items-center gap-2">
                <span className="text-success-600 dark:text-success-400">✓</span>
                <span className="text-sm font-medium text-success-700 dark:text-success-300">
                  Uploaded on {formatDate(project.dasUploadStatus.uploadedAt)}
                </span>
              </div>
              {project.dasUploadStatus.uploadedPath && (
                <span className="text-xs text-success-600 dark:text-success-400 truncate" title={project.dasUploadStatus.uploadedPath}>
                  {project.dasUploadStatus.uploadedPath}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WorkTask Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">👥 WorkTask</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Triaged By</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.triagedBy || 'Not assigned'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Design By</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.designBy || 'Not assigned'}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">QC By</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{project.qcBy || 'Not assigned'}</span>
          </div>
        </div>
      </div>

      {/* DAS Paid Services */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">💡 DAS Paid Services</h2>
          {hasPaidServices ? (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                project.dasStatus === 'Paid'
                  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                  : project.dasStatus === 'Cancelled'
                    ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300'
                    : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
              }`}
            >
              {project.dasStatus || 'Waiting on Order'}
            </span>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="btn btn-outline btn-sm"
            >
              Enable Paid Services
            </button>
          )}
        </div>

        {hasPaidServices ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
              <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lighting Pages</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{project.dasLightingPages || 0}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost per Page</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(project.dasCostPerPage)}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fee</span>
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">{formatCurrency(project.dasFee)}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rep Email</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{project.dasRepEmail || 'Not set'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSendPaidServiceEmail}
                onClick={handlePaidServicesEmail}
              >
                Draft Outlook Email
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowEmailEditor(true)}
                title="Edit email template and signature"
              >
                ✏️ Edit Template
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={onEdit}
              >
                ✏️ Edit Paid Services
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Paid services are not enabled for this project. Click &quot;Edit&quot; to add lighting pages, cost per page, and fee details.
          </p>
        )}
      </div>

      {/* Important Dates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-5 pb-4 border-b-2 border-gray-100 dark:border-gray-700">📅 Important Dates</h2>
        <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Requested Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.requestedDate)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ECD</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.ecd)}</span>
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
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Needed by Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.neededByDate)}</span>
          </div>
          <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Bid Date</label>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(project.bidDate)}</span>
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

      {/* Triage Calculation Section */}
      {(project.totalTriage > 0 || project.hasPanelSchedules || project.hasSubmittals || (!project.hasSubmittals || (project.hasSubmittals && project.needsLayoutBOM))) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🧮 Triage Calculation</h2>
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
          {(project.panelTime > 0 || project.layoutTime > 0 || project.submittalTime > 0 || project.selfQC > 0 || project.fluff > 0) && (
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
          )}

          {/* Configuration */}
          <div className="mb-6">
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

          {/* Layout Details subsection */}
          {(!project.hasSubmittals || (project.hasSubmittals && project.needsLayoutBOM)) && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">📐 Layout Details</h3>
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

      {/* Triage Calculator Modal */}
      <TriageCalculatorModal
        isOpen={showTriageModal}
        project={project}
        onSave={handleTriageSave}
        onCancel={() => setShowTriageModal(false)}
      />

      {/* Zip Selection Dialog */}
      <ZipSelectionDialog
        isOpen={showZipSelectionDialog}
        zipFiles={matchingZipFiles}
        onSelect={handleZipSelect}
        onCancel={() => setShowZipSelectionDialog(false)}
      />

      {/* Email Template Editor Modal */}
      <EmailTemplateEditor
        isOpen={showEmailEditor}
        onClose={() => setShowEmailEditor(false)}
        project={project}
      />

      {/* DAS Upload Progress Modal */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-2xl animate-pulse">📤</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Uploading to DAS Drive
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {project.isRevision ? 'Uploading revision folder...' : 'Uploading project folder...'}
                  </p>
                </div>
              </div>

              {/* Progress Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {uploadProgress.progress}%
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {uploadProgress.message}
                  </span>
                </div>
                <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-primary-500 via-primary-600 to-blue-600 transition-all duration-500 ease-out rounded-full" 
                    style={{ width: `${uploadProgress.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  </div>
                </div>

                {/* Phase indicator */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                  {uploadProgress.phase === 'checking' && (
                    <>
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center animate-pulse">
                        <span className="text-white text-sm">🔍</span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Checking paths and access...</span>
                    </>
                  )}
                  {uploadProgress.phase === 'preparing' && (
                    <>
                      <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center animate-pulse">
                        <span className="text-white text-sm">⚙️</span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">Preparing upload...</span>
                    </>
                  )}
                  {uploadProgress.phase === 'copying' && (
                    <>
                      <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center animate-pulse">
                        <span className="text-white text-sm">📁</span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {uploadProgress.currentFile ? `Copying: ${uploadProgress.currentFile}` : 'Copying files...'}
                      </span>
                    </>
                  )}
                  {uploadProgress.phase === 'complete' && (
                    <>
                      <div className="w-8 h-8 bg-success-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                      <span className="text-sm text-success-700 dark:text-success-300 font-medium">Upload complete!</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAS Upload Confirmation Dialog */}
      {showUploadConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Confirm Overwrite
                  </h3>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {uploadConfirmMessage}
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUploadConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmedUpload}
                  className="px-4 py-2 text-sm font-medium text-white bg-warning-600 hover:bg-warning-700 rounded-lg transition-colors"
                >
                  Yes, Overwrite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
