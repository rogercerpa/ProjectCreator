/**
 * StatusTrackingService - Tracks project status changes with timestamps for analytics
 * 
 * This service handles:
 * - Recording status transitions with timestamps and sources
 * - Calculating time spent in each status
 * - Setting completion date when project is completed
 * - Backfilling status history for existing projects
 */
class StatusTrackingService {
  constructor() {
    // Valid RFA status values
    this.validStatuses = [
      'None',
      'Pending',
      'In Progress',
      'Ready for QC',
      'Completed',
      'On Hold',
      'Cancelled'
    ];

    // Status sources
    this.sources = {
      CREATION: 'creation',
      MANUAL: 'manual',
      AUTOMATIC: 'automatic',
      BACKFILL: 'backfill'
    };
  }

  /**
   * Record a status change in the project's status history
   * @param {Object} project - Project object (will be mutated)
   * @param {string} newStatus - New status value
   * @param {string} source - Source of the change ('creation', 'manual', 'automatic', 'backfill')
   * @param {string} [timestamp] - Optional timestamp (ISO string), defaults to now
   * @returns {Object} Updated project with statusHistory
   */
  recordStatusChange(project, newStatus, source = 'manual', timestamp = null) {
    const now = timestamp || new Date().toISOString();
    
    // Initialize statusHistory if it doesn't exist
    if (!project.statusHistory) {
      project.statusHistory = [];
    }

    // Get the previous status from the last entry in history
    const previousStatus = project.statusHistory.length > 0 
      ? project.statusHistory[project.statusHistory.length - 1].status 
      : null;

    // Don't record if the status hasn't actually changed
    if (previousStatus === newStatus) {
      console.log(`[StatusTracking] Status unchanged (${newStatus}), skipping record`);
      return project;
    }

    // Create the history entry
    const historyEntry = {
      status: newStatus,
      timestamp: now,
      source: source,
      previousStatus: previousStatus
    };

    // Add to history
    project.statusHistory.push(historyEntry);
    console.log(`[StatusTracking] Recorded status change: ${previousStatus || 'null'} -> ${newStatus} (source: ${source})`);

    // If status is 'Completed', set the completedAt timestamp
    if (newStatus === 'Completed') {
      project.completedAt = now;
      console.log(`[StatusTracking] Project completed at ${now}`);
    }

    // Recalculate durations
    this.calculateDurations(project);

    return project;
  }

  /**
   * Calculate the duration spent in each status and total project duration
   * @param {Object} project - Project object (will be mutated)
   * @returns {Object} Updated project with statusDurations and totalProjectDuration
   */
  calculateDurations(project) {
    if (!project.statusHistory || project.statusHistory.length === 0) {
      project.statusDurations = {};
      project.totalProjectDuration = 0;
      return project;
    }

    const durations = {};
    const history = project.statusHistory;

    // Sort history by timestamp to ensure correct order
    const sortedHistory = [...history].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Calculate duration for each status period
    for (let i = 0; i < sortedHistory.length; i++) {
      const entry = sortedHistory[i];
      const status = entry.status;
      const startTime = new Date(entry.timestamp).getTime();
      
      // End time is either the next status change or now
      let endTime;
      if (i < sortedHistory.length - 1) {
        endTime = new Date(sortedHistory[i + 1].timestamp).getTime();
      } else {
        // For the current/last status, use now or completedAt if completed
        if (status === 'Completed' && project.completedAt) {
          endTime = new Date(project.completedAt).getTime();
        } else {
          endTime = Date.now();
        }
      }

      const duration = endTime - startTime;
      
      // Add to existing duration for this status (handles cases where status returns to previous value)
      if (!durations[status]) {
        durations[status] = 0;
      }
      durations[status] += duration;
    }

    project.statusDurations = durations;

    // Calculate total project duration (from first status to completion or now)
    const firstEntry = sortedHistory[0];
    const lastEntry = sortedHistory[sortedHistory.length - 1];
    const startTime = new Date(firstEntry.timestamp).getTime();
    
    let endTime;
    if (lastEntry.status === 'Completed' && project.completedAt) {
      endTime = new Date(project.completedAt).getTime();
    } else {
      endTime = Date.now();
    }
    
    project.totalProjectDuration = endTime - startTime;

    return project;
  }

  /**
   * Get the timestamp when the project was completed
   * @param {Array} statusHistory - Status history array
   * @returns {string|null} ISO timestamp when Completed was reached, or null
   */
  getCompletedTimestamp(statusHistory) {
    if (!statusHistory || statusHistory.length === 0) {
      return null;
    }

    // Find the most recent 'Completed' entry
    const completedEntries = statusHistory.filter(entry => entry.status === 'Completed');
    if (completedEntries.length === 0) {
      return null;
    }

    // Return the most recent one
    return completedEntries[completedEntries.length - 1].timestamp;
  }

  /**
   * Backfill status history for an existing project with manual dates
   * @param {Object} project - Project object (will be mutated)
   * @param {Array} statusDates - Array of { status, timestamp } objects
   * @returns {Object} Updated project with backfilled statusHistory
   */
  backfillStatusHistory(project, statusDates) {
    if (!statusDates || statusDates.length === 0) {
      console.log('[StatusTracking] No status dates provided for backfill');
      return project;
    }

    // Sort by timestamp
    const sortedDates = [...statusDates].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Initialize or clear status history for backfill
    project.statusHistory = [];

    // Add each entry
    let previousStatus = null;
    for (const entry of sortedDates) {
      if (!entry.status || !entry.timestamp) {
        console.warn('[StatusTracking] Skipping invalid backfill entry:', entry);
        continue;
      }

      project.statusHistory.push({
        status: entry.status,
        timestamp: entry.timestamp,
        source: this.sources.BACKFILL,
        previousStatus: previousStatus
      });

      previousStatus = entry.status;
    }

    // Set completedAt if the last status is Completed
    const lastEntry = project.statusHistory[project.statusHistory.length - 1];
    if (lastEntry && lastEntry.status === 'Completed') {
      project.completedAt = lastEntry.timestamp;
    }

    // Calculate durations
    this.calculateDurations(project);

    console.log(`[StatusTracking] Backfilled ${project.statusHistory.length} status entries for project`);
    return project;
  }

  /**
   * Initialize status history for a new project
   * @param {Object} project - Project object (will be mutated)
   * @param {string} initialStatus - Initial status (default: 'In Progress')
   * @returns {Object} Updated project with initial statusHistory
   */
  initializeStatusHistory(project, initialStatus = 'In Progress') {
    const now = project.createdAt || new Date().toISOString();
    
    project.statusHistory = [{
      status: initialStatus,
      timestamp: now,
      source: this.sources.CREATION,
      previousStatus: null
    }];

    project.statusDurations = {};
    project.totalProjectDuration = 0;

    console.log(`[StatusTracking] Initialized status history with ${initialStatus}`);
    return project;
  }

  /**
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration (e.g., "2d 5h 30m")
   */
  formatDuration(milliseconds) {
    if (!milliseconds || milliseconds <= 0) {
      return '0m';
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0 || parts.length === 0) parts.push(`${minutes % 60}m`);

    return parts.join(' ');
  }

  /**
   * Get analytics summary for a project
   * @param {Object} project - Project object
   * @returns {Object} Analytics summary
   */
  getAnalyticsSummary(project) {
    const summary = {
      totalDuration: project.totalProjectDuration || 0,
      totalDurationFormatted: this.formatDuration(project.totalProjectDuration || 0),
      statusDurations: {},
      statusCount: project.statusHistory?.length || 0,
      currentStatus: project.rfaStatus || 'Unknown',
      isCompleted: project.rfaStatus === 'Completed',
      completedAt: project.completedAt || null
    };

    // Add formatted durations for each status
    if (project.statusDurations) {
      for (const [status, duration] of Object.entries(project.statusDurations)) {
        summary.statusDurations[status] = {
          milliseconds: duration,
          formatted: this.formatDuration(duration),
          percentage: project.totalProjectDuration > 0 
            ? Math.round((duration / project.totalProjectDuration) * 100) 
            : 0
        };
      }
    }

    return summary;
  }

  /**
   * Check if project has status history (for determining if backfill is needed)
   * @param {Object} project - Project object
   * @returns {boolean} True if project has status history
   */
  hasStatusHistory(project) {
    return project.statusHistory && project.statusHistory.length > 0;
  }

  /**
   * Detect if status has changed between existing and updated project data
   * @param {Object} existingProject - Existing project from database
   * @param {Object} updatedProject - Updated project data
   * @returns {Object|null} { oldStatus, newStatus } or null if no change
   */
  detectStatusChange(existingProject, updatedProject) {
    const oldStatus = existingProject?.rfaStatus;
    const newStatus = updatedProject?.rfaStatus;

    if (oldStatus !== newStatus && newStatus) {
      return { oldStatus, newStatus };
    }

    return null;
  }
}

module.exports = StatusTrackingService;
