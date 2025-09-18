/**
 * DuplicateProjectDetectionClient
 * Renderer-side client for duplicate project detection
 * Uses IPC to communicate with main process DuplicateProjectDetectionService
 */
class DuplicateProjectDetectionClient {
  constructor() {
    // Verify electronAPI is available
    if (!window.electronAPI || !window.electronAPI.duplicateCheckProject) {
      console.warn('DuplicateProjectDetectionClient: electronAPI not available');
      this.isAvailable = false;
    } else {
      this.isAvailable = true;
    }
  }

  /**
   * Check for existing projects that match the new project data
   * @param {Object} projectData - Project information from form/Agile import
   * @returns {Promise<Object>} Detection result with existing project details
   */
  async checkForExistingProject(projectData) {
    if (!this.isAvailable) {
      console.warn('DuplicateProjectDetectionClient: Service not available, proceeding without detection');
      return {
        isDuplicate: false,
        canProceed: true,
        message: 'Duplicate detection service not available'
      };
    }

    try {
      console.log('🔍 DuplicateProjectDetectionClient: Sending IPC request for duplicate check');
      const result = await window.electronAPI.duplicateCheckProject(projectData);
      console.log('📨 DuplicateProjectDetectionClient: Received result:', result);
      return result;
    } catch (error) {
      console.error('❌ DuplicateProjectDetectionClient: IPC error:', error);
      return {
        isDuplicate: false,
        canProceed: true,
        error: error.message,
        message: 'Duplicate detection failed - proceeding with caution'
      };
    }
  }

  /**
   * Format duplicate detection results for UI display
   * @param {Object} detectionResult - Result from checkForExistingProject
   * @returns {Object} Formatted data for UI components
   */
  formatForUI(detectionResult) {
    if (!detectionResult.isDuplicate) {
      return {
        showWarning: false,
        canProceed: true
      };
    }

    const primary = detectionResult.primaryDuplicate;
    
    return {
      showWarning: true,
      canProceed: false,
      warningData: {
        projectName: primary.projectFolderName,
        foundInYear: primary.year,
        latestRFA: primary.latestRFA,
        suggestedNextVersion: primary.suggestedNextVersion,
        allRFAFolders: primary.rfaFolders,
        totalProjects: detectionResult.allDuplicates?.length || 1,
        message: detectionResult.message
      }
    };
  }

  /**
   * Check if the service is available and working
   * @returns {boolean} True if service is available
   */
  isServiceAvailable() {
    return this.isAvailable;
  }
}

export default DuplicateProjectDetectionClient;
