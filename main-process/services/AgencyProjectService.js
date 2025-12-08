// AgencyProjectService - Links projects to agencies and provides agency-specific project data
const ProjectPersistenceService = require('./ProjectPersistenceService');

class AgencyProjectService {
  constructor() {
    this.projectPersistenceService = new ProjectPersistenceService();
  }

  // Get all projects for a specific agency
  async getProjectsByAgency(agencyName, agentNumber) {
    try {
      const allProjects = await this.projectPersistenceService.loadProjects();
      
      // Filter projects by agency name (primary matching method)
      // Note: agentNumber parameter is kept for API compatibility but not used in matching
      // because agency.agencyNumber (agency record ID) != project.agentNumber (agent number from project creation)
      const agencyProjects = allProjects.filter(project => {
        if (!agencyName || !project.agencyName) {
          return false;
        }
        
        // Match by agency name (case-insensitive)
        return project.agencyName.toLowerCase() === agencyName.toLowerCase();
      });

      return {
        success: true,
        projects: agencyProjects,
        count: agencyProjects.length
      };
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
      const result = await this.getProjectsByAgency(agencyName, agentNumber);
      if (!result.success) return result;

      const activeProjects = result.projects.filter(project => 
        project.status && project.status.toLowerCase() === 'active'
      );

      return {
        success: true,
        projects: activeProjects,
        count: activeProjects.length
      };
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

  // Get recently completed projects (within last 30 days)
  async getRecentlyCompletedProjects(agencyName, agentNumber, days = 30) {
    try {
      const result = await this.getProjectsByAgency(agencyName, agentNumber);
      if (!result.success) return result;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const completedProjects = result.projects.filter(project => {
        if (!project.status || project.status.toLowerCase() !== 'complete') {
          return false;
        }
        
        // Check if project was completed recently
        if (project.completedDate) {
          const completedDate = new Date(project.completedDate);
          return completedDate >= cutoffDate;
        }
        
        // Fallback to lastModified if completedDate not available
        if (project.lastModified) {
          const modifiedDate = new Date(project.lastModified);
          return modifiedDate >= cutoffDate;
        }
        
        return false;
      });

      return {
        success: true,
        projects: completedProjects,
        count: completedProjects.length
      };
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
      const result = await this.getProjectsByAgency(agencyName, agentNumber);
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          statistics: this.getEmptyStatistics()
        };
      }

      const projects = result.projects;
      const totalProjects = projects.length;
      
      const activeProjects = projects.filter(p => 
        p.status && p.status.toLowerCase() === 'active'
      ).length;
      
      const completedProjects = projects.filter(p => 
        p.status && p.status.toLowerCase() === 'complete'
      ).length;
      
      const draftProjects = projects.filter(p => 
        p.status && p.status.toLowerCase() === 'draft'
      ).length;

      // Calculate average project duration (for completed projects)
      let totalDuration = 0;
      let durationCount = 0;
      
      projects.forEach(project => {
        if (project.submittedDate && project.completedDate) {
          try {
            const start = new Date(project.submittedDate);
            const end = new Date(project.completedDate);
            const duration = (end - start) / (1000 * 60 * 60 * 24); // days
            if (duration > 0) {
              totalDuration += duration;
              durationCount++;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      const averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;
      const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

      return {
        success: true,
        statistics: {
          totalProjects,
          activeProjects,
          completedProjects,
          draftProjects,
          averageDuration: Math.round(averageDuration * 10) / 10, // Round to 1 decimal
          completionRate: Math.round(completionRate * 10) / 10, // Round to 1 decimal
          projects
        }
      };
    } catch (error) {
      console.error('Error getting agency project statistics:', error);
      return {
        success: false,
        error: error.message,
        statistics: this.getEmptyStatistics()
      };
    }
  }

  // Get empty statistics object
  getEmptyStatistics() {
    return {
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      draftProjects: 0,
      averageDuration: 0,
      completionRate: 0,
      projects: []
    };
  }

  // Get project performance metrics
  async getAgencyPerformanceMetrics(agencyName, agentNumber) {
    try {
      const result = await this.getProjectsByAgency(agencyName, agentNumber);
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          metrics: this.getEmptyMetrics()
        };
      }

      const projects = result.projects;
      let onTimeCount = 0;
      let lateCount = 0;
      let totalProjects = 0;

      projects.forEach(project => {
        if (project.dueDate && project.completedDate) {
          try {
            const dueDate = new Date(project.dueDate);
            const completedDate = new Date(project.completedDate);
            totalProjects++;
            
            if (completedDate <= dueDate) {
              onTimeCount++;
            } else {
              lateCount++;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });

      const onTimeRate = totalProjects > 0 ? (onTimeCount / totalProjects) * 100 : 0;

      return {
        success: true,
        metrics: {
          onTimeCount,
          lateCount,
          totalProjects,
          onTimeRate: Math.round(onTimeRate * 10) / 10
        }
      };
    } catch (error) {
      console.error('Error getting agency performance metrics:', error);
      return {
        success: false,
        error: error.message,
        metrics: this.getEmptyMetrics()
      };
    }
  }

  // Get empty metrics object
  getEmptyMetrics() {
    return {
      onTimeCount: 0,
      lateCount: 0,
      totalProjects: 0,
      onTimeRate: 0
    };
  }
}

module.exports = AgencyProjectService;

