import React, { useState } from 'react';
import './ProjectDetails.css';

/**
 * ProjectDetails - Read-only display of project information
 * Shows all project details in a well-organized, read-only format
 */
const ProjectDetails = ({ project, onEdit }) => {
  const [isExporting, setIsExporting] = useState(false);
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      alert('Project must have RFA Number and Project Name to export to DAS Board.');
      return;
    }

    setIsExporting(true);
    try {
      // Map project data to format expected by backend
      const mappedProjectData = mapProjectDataForExport(project);
      const mappedTriageData = mapProjectDataForExport(project);
      
      const result = await window.electronAPI.exportDASBoard(mappedProjectData, mappedTriageData);
      
      if (result.success) {
        // Copy to clipboard - format the data as needed for DAS Board
        const exportText = `${result.data.firstColumn}\t${result.data.projectName}\t${result.data.dueDate}\t${result.data.triageTime}`;
        
        await navigator.clipboard.writeText(exportText);
        alert('Project data exported to DAS Board format and copied to clipboard!');
      } else {
        alert(`Failed to export to DAS Board: ${result.error}`);
      }
    } catch (error) {
      console.error('Export to DAS Board failed:', error);
      alert('Failed to export to DAS Board.');
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
        alert('Project triage breakdown exported to Agile format and copied to clipboard!');
      } else {
        alert(`Failed to export to Agile: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Export to Agile failed:', error);
      alert('Failed to export to Agile.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="project-details">
      {/* Project Overview */}
      <div className="details-section">
        <div className="section-header">
          <h2>📋 Project Overview</h2>
          <div className="header-actions">
            <button 
              onClick={handleExportToDASBoard}
              disabled={isExporting || !project.rfaNumber || !project.projectName}
              className="btn btn-outline btn-small"
              title="Export project data to DAS Board format"
            >
              📊 Copy to DAS Board
            </button>
            <button 
              onClick={handleExportToAgile}
              disabled={isExporting}
              className="btn btn-outline btn-small"
              title="Export triage breakdown to Agile format"
            >
              📈 Copy to Agile
            </button>
            <button onClick={onEdit} className="btn btn-outline btn-small">
              ✏️ Edit
            </button>
          </div>
        </div>
        <div className="details-grid">
          <div className="detail-item">
            <label>Project Name</label>
            <span>{project.projectName || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>RFA Number</label>
            <span>{project.rfaNumber || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>Agent Number</label>
            <span>{project.agentNumber || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>Project Container</label>
            <span>{project.projectContainer || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>RFA Type</label>
            <span>{project.rfaType || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>Regional Team</label>
            <span>{project.regionalTeam || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>National Account</label>
            <span>{project.nationalAccount || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>Status</label>
            <span className={`status-badge ${project.status?.toLowerCase() || 'active'}`}>
              {project.status || 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="details-section">
        <h2>📊 Project Details</h2>
        <div className="details-grid">
          <div className="detail-item">
            <label>Complexity</label>
            <span>{project.complexity || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>RFA Value</label>
            <span>{formatCurrency(project.rfaValue)}</span>
          </div>
          <div className="detail-item">
            <label>Products</label>
            <span>{project.products || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>Assigned To</label>
            <span>{project.assignedTo || 'Unassigned'}</span>
          </div>
          <div className="detail-item">
            <label>Rep Contacts</label>
            <span>{project.repContacts || 'Not specified'}</span>
          </div>
          <div className="detail-item">
            <label>First Available</label>
            <span>{project.firstAvailable ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="details-section">
        <h2>📅 Important Dates</h2>
        <div className="details-grid">
          <div className="detail-item">
            <label>ECD (Expected Completion Date)</label>
            <span>{formatDate(project.ecd)}</span>
          </div>
          <div className="detail-item">
            <label>Requested Date</label>
            <span>{formatDate(project.requestedDate)}</span>
          </div>
          <div className="detail-item">
            <label>Submitted Date</label>
            <span>{formatDate(project.submittedDate)}</span>
          </div>
          <div className="detail-item">
            <label>Due Date</label>
            <span>{formatDate(project.dueDate)}</span>
          </div>
          <div className="detail-item">
            <label>Created</label>
            <span>{formatDate(project.createdAt)}</span>
          </div>
          <div className="detail-item">
            <label>Last Updated</label>
            <span>{formatDate(project.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Triage Information */}
      {(project.totalTriage > 0 || project.hasPanelSchedules || project.hasSubmittals) && (
        <div className="details-section">
          <h2>🧮 Triage Information</h2>
          <div className="triage-summary">
            <div className="triage-total">
              <label>Total Triage Time</label>
              <span className="triage-hours">{project.totalTriage || 0} hours</span>
            </div>
            
            <div className="triage-breakdown">
              <h3>Time Breakdown</h3>
              <div className="breakdown-grid">
                {project.panelTime > 0 && (
                  <div className="breakdown-item">
                    <span>Panel Time:</span>
                    <span>{project.panelTime} hr</span>
                  </div>
                )}
                {project.layoutTime > 0 && (
                  <div className="breakdown-item">
                    <span>Layout Time:</span>
                    <span>{project.layoutTime} hr</span>
                  </div>
                )}
                {project.submittalTime > 0 && (
                  <div className="breakdown-item">
                    <span>Submittal Time:</span>
                    <span>{project.submittalTime} hr</span>
                  </div>
                )}
                {project.selfQC > 0 && (
                  <div className="breakdown-item">
                    <span>Self QC:</span>
                    <span>{project.selfQC} hr</span>
                  </div>
                )}
                {project.fluff > 0 && (
                  <div className="breakdown-item">
                    <span>Fluff:</span>
                    <span>{project.fluff} hr</span>
                  </div>
                )}
              </div>
            </div>

            <div className="triage-config">
              <h3>Configuration</h3>
              <div className="config-items">
                <div className="config-item">
                  <span>Panel Schedules:</span>
                  <span className={project.hasPanelSchedules ? 'enabled' : 'disabled'}>
                    {project.hasPanelSchedules ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="config-item">
                  <span>Submittal Section:</span>
                  <span className={project.hasSubmittals ? 'enabled' : 'disabled'}>
                    {project.hasSubmittals ? 'Yes' : 'No'}
                  </span>
                </div>
                {project.hasSubmittals && (
                  <div className="config-item">
                    <span>Needs Layout/BOM:</span>
                    <span className={project.needsLayoutBOM ? 'enabled' : 'disabled'}>
                      {project.needsLayoutBOM ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel Schedule Details */}
      {project.hasPanelSchedules && (
        <div className="details-section">
          <h2>⚡ Panel Schedule Details</h2>
          <div className="panel-details">
            <div className="panel-group">
              <h3>LMPs</h3>
              <div className="panel-grid">
                <div className="panel-item">
                  <span>Large:</span>
                  <span>{project.largeLMPs || 0}</span>
                </div>
                <div className="panel-item">
                  <span>Medium:</span>
                  <span>{project.mediumLMPs || 0}</span>
                </div>
                <div className="panel-item">
                  <span>Small:</span>
                  <span>{project.smallLMPs || 0}</span>
                </div>
              </div>
            </div>
            
            <div className="panel-group">
              <h3>nLight ARPs</h3>
              <div className="panel-grid">
                <div className="panel-item">
                  <span>ARP 8:</span>
                  <span>{project.arp8 || 0}</span>
                </div>
                <div className="panel-item">
                  <span>ARP 16:</span>
                  <span>{project.arp16 || 0}</span>
                </div>
                <div className="panel-item">
                  <span>ARP 32:</span>
                  <span>{project.arp32 || 0}</span>
                </div>
                <div className="panel-item">
                  <span>ARP 48:</span>
                  <span>{project.arp48 || 0}</span>
                </div>
              </div>
            </div>

            <div className="panel-group">
              <h3>E-Sheets</h3>
              <div className="panel-item">
                <span>Panel Schedules on E-Sheets:</span>
                <span>{project.esheetsSchedules === 1 ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layout Details */}
      {(!project.hasSubmittals || (project.hasSubmittals && project.needsLayoutBOM)) && (
        <div className="details-section">
          <h2>📐 Layout Details</h2>
          <div className="layout-details">
            <div className="details-grid">
              <div className="detail-item">
                <label>Number of Rooms</label>
                <span>{project.numOfRooms || 0}</span>
              </div>
              <div className="detail-item">
                <label>Room Multiplier</label>
                <span>{project.roomMultiplier || 2} min/room</span>
              </div>
              <div className="detail-item">
                <label>Override Rooms</label>
                <span>{project.overrideRooms || 0} hr</span>
              </div>
              <div className="detail-item">
                <label>Review/Setup Time</label>
                <span>{project.reviewSetup || 0} hr</span>
              </div>
              <div className="detail-item">
                <label>Number of Pages</label>
                <span>{project.numOfPages || 1}</span>
              </div>
              <div className="detail-item">
                <label>Spec Review</label>
                <span>{project.specReview || 0} hr</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submittal Details */}
      {project.hasSubmittals && (
        <div className="details-section">
          <h2>📝 Submittal Details</h2>
          <div className="submittal-details">
            <div className="details-grid">
              <div className="detail-item">
                <label>Number of Rooms</label>
                <span>{project.numOfSubRooms || 0}</span>
              </div>
              <div className="detail-item">
                <label>Riser Multiplier</label>
                <span>{project.riserMultiplier || 1} min/room</span>
              </div>
              <div className="detail-item">
                <label>Override Submittal Rooms</label>
                <span>{project.overrideSubRooms || 0} hr</span>
              </div>
              <div className="detail-item">
                <label>Sequence of Operation</label>
                <span>{project.soo || 0} hr</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photometrics */}
      {project.showPhotometrics && (
        <div className="details-section">
          <h2>💡 Photometrics</h2>
          <div className="detail-item">
            <label>Photo Software</label>
            <span>{project.photoSoftware || 'Not specified'}</span>
          </div>
        </div>
      )}

      {/* Additional Settings */}
      <div className="details-section">
        <h2>⚙️ Additional Settings</h2>
        <div className="details-grid">
          <div className="detail-item">
            <label>Save Location</label>
            <span>{project.saveLocation || 'Server'}</span>
          </div>
          <div className="detail-item">
            <label>Is Revision</label>
            <span>{project.isRevision ? 'Yes' : 'No'}</span>
          </div>
          <div className="detail-item">
            <label>Source</label>
            <span>{project.sourceType === 'wizard' ? 'Project Wizard' : 'Classic Form'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
