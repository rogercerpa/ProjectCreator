// AgencyProjectService - Frontend service wrapper for agency project operations
class AgencyProjectService {
  // Get all projects for a specific agency
  async getProjectsByAgency(agencyName, agentNumber) {
    try {
      const result = await window.electronAPI.agencyProjectsGetAll(agencyName, agentNumber);
      return result;
    } catch (error) {
      console.error('Error getting projects by agency:', error);
      return {
        success: false,
        error: error.message,
        projects: [],
        count: 0
      };
    }
  }

  // Get active projects for an agency
  async getActiveProjectsByAgency(agencyName, agentNumber) {
    try {
      const result = await window.electronAPI.agencyProjectsGetActive(agencyName, agentNumber);
      return result;
    } catch (error) {
      console.error('Error getting active projects by agency:', error);
      return {
        success: false,
        error: error.message,
        projects: [],
        count: 0
      };
    }
  }

  // Get recently completed projects
  async getRecentlyCompletedProjects(agencyName, agentNumber, days = 30) {
    try {
      const result = await window.electronAPI.agencyProjectsGetRecentlyCompleted(agencyName, agentNumber, days);
      return result;
    } catch (error) {
      console.error('Error getting recently completed projects:', error);
      return {
        success: false,
        error: error.message,
        projects: [],
        count: 0
      };
    }
  }

  // Get project statistics for an agency
  async getAgencyProjectStatistics(agencyName, agentNumber) {
    try {
      const result = await window.electronAPI.agencyProjectsGetStatistics(agencyName, agentNumber);
      return result;
    } catch (error) {
      console.error('Error getting agency project statistics:', error);
      return {
        success: false,
        error: error.message,
        statistics: {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          draftProjects: 0,
          averageDuration: 0,
          completionRate: 0,
          projects: []
        }
      };
    }
  }

  // Get performance metrics for an agency
  async getAgencyPerformanceMetrics(agencyName, agentNumber) {
    try {
      const result = await window.electronAPI.agencyProjectsGetPerformanceMetrics(agencyName, agentNumber);
      return result;
    } catch (error) {
      console.error('Error getting agency performance metrics:', error);
      return {
        success: false,
        error: error.message,
        metrics: {
          onTimeCount: 0,
          lateCount: 0,
          totalProjects: 0,
          onTimeRate: 0
        }
      };
    }
  }
}

export default new AgencyProjectService();

