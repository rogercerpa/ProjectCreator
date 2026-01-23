/**
 * Report Data Service
 * Aggregates project data for analytics reports
 */

import {
  getMonthDateRange,
  getPreviousMonth,
  isDateInRange,
  calculatePercentageChange,
  groupAndCount,
  groupAndSum,
  getWeekOfMonth,
} from '../utils/reportHelpers';

class ReportDataService {
  constructor() {
    this.projects = [];
  }

  /**
   * Set the projects data
   * @param {Array} projects - Array of project objects
   */
  setProjects(projects) {
    this.projects = Array.isArray(projects) ? projects : [];
  }

  /**
   * Filter projects by month based on view mode
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @param {string} viewMode - 'created' or 'completed'
   * @returns {Array} Filtered projects
   */
  filterProjectsByMonth(year, month, viewMode = 'created') {
    const { startDate, endDate } = getMonthDateRange(year, month);
    
    return this.projects.filter(project => {
      if (viewMode === 'completed') {
        return isDateInRange(project.completedAt, startDate, endDate);
      }
      // Default to created/submitted date
      const dateField = project.createdAt || project.submittedDate;
      return isDateInRange(dateField, startDate, endDate);
    });
  }

  /**
   * Calculate KPIs for a given month
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @param {string} viewMode - 'created' or 'completed'
   * @returns {object} KPI metrics
   */
  calculateKPIs(year, month, viewMode = 'created') {
    const currentProjects = this.filterProjectsByMonth(year, month, viewMode);
    const prevMonth = getPreviousMonth(year, month);
    const previousProjects = this.filterProjectsByMonth(prevMonth.year, prevMonth.month, viewMode);

    // Total Projects
    const totalProjects = currentProjects.length;
    const prevTotalProjects = previousProjects.length;

    // Completed Projects
    const completedProjects = currentProjects.filter(
      p => p.rfaStatus === 'Completed' || p.status === 'Completed'
    ).length;
    const prevCompletedProjects = previousProjects.filter(
      p => p.rfaStatus === 'Completed' || p.status === 'Completed'
    ).length;

    // Completion Rate
    const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
    const prevCompletionRate = prevTotalProjects > 0 ? (prevCompletedProjects / prevTotalProjects) * 100 : 0;

    // Total RFA Value
    const totalRfaValue = currentProjects.reduce((sum, p) => sum + (parseFloat(p.rfaValue) || 0), 0);
    const prevTotalRfaValue = previousProjects.reduce((sum, p) => sum + (parseFloat(p.rfaValue) || 0), 0);

    // Total DAS Revenue
    const dasProjects = currentProjects.filter(p => p.dasPaidServiceEnabled);
    const totalDasRevenue = dasProjects.reduce((sum, p) => sum + (parseFloat(p.dasFee) || 0), 0);
    const prevDasProjects = previousProjects.filter(p => p.dasPaidServiceEnabled);
    const prevTotalDasRevenue = prevDasProjects.reduce((sum, p) => sum + (parseFloat(p.dasFee) || 0), 0);

    // Average Turnaround Time (for completed projects)
    const completedWithDates = currentProjects.filter(p => 
      (p.rfaStatus === 'Completed' || p.status === 'Completed') && 
      p.completedAt && 
      (p.createdAt || p.submittedDate)
    );
    
    let avgTurnaroundTime = 0;
    if (completedWithDates.length > 0) {
      const totalDuration = completedWithDates.reduce((sum, p) => {
        const start = new Date(p.createdAt || p.submittedDate);
        const end = new Date(p.completedAt);
        return sum + (end - start);
      }, 0);
      avgTurnaroundTime = totalDuration / completedWithDates.length;
    }

    const prevCompletedWithDates = previousProjects.filter(p => 
      (p.rfaStatus === 'Completed' || p.status === 'Completed') && 
      p.completedAt && 
      (p.createdAt || p.submittedDate)
    );
    
    let prevAvgTurnaroundTime = 0;
    if (prevCompletedWithDates.length > 0) {
      const prevTotalDuration = prevCompletedWithDates.reduce((sum, p) => {
        const start = new Date(p.createdAt || p.submittedDate);
        const end = new Date(p.completedAt);
        return sum + (end - start);
      }, 0);
      prevAvgTurnaroundTime = prevTotalDuration / prevCompletedWithDates.length;
    }

    // On-Time Delivery Rate
    const projectsWithDueDate = currentProjects.filter(p => 
      (p.rfaStatus === 'Completed' || p.status === 'Completed') && 
      p.dueDate && 
      p.completedAt
    );
    
    const onTimeProjects = projectsWithDueDate.filter(p => {
      const dueDate = new Date(p.dueDate);
      const completedDate = new Date(p.completedAt);
      return completedDate <= dueDate;
    }).length;
    
    const onTimeRate = projectsWithDueDate.length > 0 
      ? (onTimeProjects / projectsWithDueDate.length) * 100 
      : 0;

    const prevProjectsWithDueDate = previousProjects.filter(p => 
      (p.rfaStatus === 'Completed' || p.status === 'Completed') && 
      p.dueDate && 
      p.completedAt
    );
    
    const prevOnTimeProjects = prevProjectsWithDueDate.filter(p => {
      const dueDate = new Date(p.dueDate);
      const completedDate = new Date(p.completedAt);
      return completedDate <= dueDate;
    }).length;
    
    const prevOnTimeRate = prevProjectsWithDueDate.length > 0 
      ? (prevOnTimeProjects / prevProjectsWithDueDate.length) * 100 
      : 0;

    return {
      totalProjects: {
        value: totalProjects,
        change: calculatePercentageChange(totalProjects, prevTotalProjects),
      },
      completedProjects: {
        value: completedProjects,
        rate: completionRate,
        change: calculatePercentageChange(completedProjects, prevCompletedProjects),
      },
      totalRfaValue: {
        value: totalRfaValue,
        change: calculatePercentageChange(totalRfaValue, prevTotalRfaValue),
      },
      totalDasRevenue: {
        value: totalDasRevenue,
        count: dasProjects.length,
        change: calculatePercentageChange(totalDasRevenue, prevTotalDasRevenue),
      },
      avgTurnaroundTime: {
        value: avgTurnaroundTime,
        change: calculatePercentageChange(prevAvgTurnaroundTime, avgTurnaroundTime), // Inverted - lower is better
      },
      onTimeRate: {
        value: onTimeRate,
        change: calculatePercentageChange(onTimeRate, prevOnTimeRate),
      },
    };
  }

  /**
   * Get RFA Type distribution
   * @param {Array} projects - Filtered projects
   * @returns {Array} Distribution data for chart
   */
  getRfaTypeDistribution(projects) {
    return groupAndCount(projects, 'rfaType');
  }

  /**
   * Get Regional Team distribution
   * @param {Array} projects - Filtered projects
   * @returns {Array} Distribution data for chart
   */
  getRegionalDistribution(projects) {
    return groupAndCount(projects, 'regionalTeam');
  }

  /**
   * Get Status distribution
   * @param {Array} projects - Filtered projects
   * @returns {Array} Distribution data for chart
   */
  getStatusDistribution(projects) {
    return groupAndCount(projects, 'rfaStatus');
  }

  /**
   * Get top agencies by project count
   * @param {Array} projects - Filtered projects
   * @param {number} limit - Number of agencies to return
   * @returns {Array} Top agencies data for chart
   */
  getTopAgencies(projects, limit = 10) {
    return groupAndCount(projects, 'agencyName').slice(0, limit);
  }

  /**
   * Get weekly project intake
   * @param {Array} projects - Filtered projects
   * @param {number} year - Year
   * @param {number} month - Month
   * @returns {Array} Weekly data for chart
   */
  getWeeklyIntake(projects, year, month) {
    const weeks = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0, 'Week 5': 0 };
    
    projects.forEach(project => {
      const dateField = project.createdAt || project.submittedDate;
      if (dateField) {
        const date = new Date(dateField);
        const week = getWeekOfMonth(date);
        const weekKey = `Week ${Math.min(week, 5)}`;
        weeks[weekKey] = (weeks[weekKey] || 0) + 1;
      }
    });

    return Object.entries(weeks)
      .map(([name, value]) => ({ name, value }))
      .filter(w => w.value > 0 || w.name !== 'Week 5');
  }

  /**
   * Get product mix
   * @param {Array} projects - Filtered projects
   * @returns {Array} Product data for chart
   */
  getProductMix(projects) {
    const productCounts = {};
    
    projects.forEach(project => {
      const products = Array.isArray(project.products) 
        ? project.products 
        : (project.products || '').split(',').map(p => p.trim()).filter(Boolean);
      
      products.forEach(product => {
        if (product) {
          productCounts[product] = (productCounts[product] || 0) + 1;
        }
      });
    });

    return Object.entries(productCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  /**
   * Get team performance data
   * @param {Array} projects - Filtered projects
   * @returns {object} Team performance metrics
   */
  getTeamPerformance(projects) {
    return {
      byDesigner: groupAndCount(projects.filter(p => p.designBy), 'designBy').slice(0, 10),
      byQC: groupAndCount(projects.filter(p => p.qcBy), 'qcBy').slice(0, 10),
      byTriage: groupAndCount(projects.filter(p => p.triagedBy), 'triagedBy').slice(0, 10),
    };
  }

  /**
   * Get DAS revenue breakdown
   * @param {Array} projects - Filtered projects
   * @returns {object} DAS revenue metrics
   */
  getDasRevenueBreakdown(projects) {
    const dasProjects = projects.filter(p => p.dasPaidServiceEnabled);
    
    const byStatus = {};
    dasProjects.forEach(p => {
      const status = p.dasStatus || 'Unknown';
      if (!byStatus[status]) {
        byStatus[status] = { count: 0, revenue: 0 };
      }
      byStatus[status].count++;
      byStatus[status].revenue += parseFloat(p.dasFee) || 0;
    });

    const statusBreakdown = Object.entries(byStatus).map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue,
    }));

    return {
      totalCount: dasProjects.length,
      totalRevenue: dasProjects.reduce((sum, p) => sum + (parseFloat(p.dasFee) || 0), 0),
      avgFee: dasProjects.length > 0 
        ? dasProjects.reduce((sum, p) => sum + (parseFloat(p.dasFee) || 0), 0) / dasProjects.length 
        : 0,
      byStatus: statusBreakdown,
    };
  }

  /**
   * Get RFA value distribution
   * @param {Array} projects - Filtered projects
   * @returns {object} RFA value metrics
   */
  getRfaValueDistribution(projects) {
    const byRegion = groupAndSum(projects, 'regionalTeam', 'rfaValue');
    const byType = groupAndSum(projects, 'rfaType', 'rfaValue');

    return {
      byRegion: byRegion.slice(0, 10),
      byType: byType.slice(0, 10),
      total: projects.reduce((sum, p) => sum + (parseFloat(p.rfaValue) || 0), 0),
      average: projects.length > 0 
        ? projects.reduce((sum, p) => sum + (parseFloat(p.rfaValue) || 0), 0) / projects.length 
        : 0,
    };
  }

  /**
   * Generate complete report data
   * @param {number} year - Year
   * @param {number} month - Month (0-11)
   * @param {string} viewMode - 'created' or 'completed'
   * @returns {object} Complete report data
   */
  generateReport(year, month, viewMode = 'created') {
    const projects = this.filterProjectsByMonth(year, month, viewMode);
    const kpis = this.calculateKPIs(year, month, viewMode);

    return {
      period: { year, month, viewMode },
      projectCount: projects.length,
      kpis,
      charts: {
        rfaTypeDistribution: this.getRfaTypeDistribution(projects),
        regionalDistribution: this.getRegionalDistribution(projects),
        statusDistribution: this.getStatusDistribution(projects),
        topAgencies: this.getTopAgencies(projects),
        weeklyIntake: this.getWeeklyIntake(projects, year, month),
        productMix: this.getProductMix(projects),
      },
      teamPerformance: this.getTeamPerformance(projects),
      dasRevenue: this.getDasRevenueBreakdown(projects),
      rfaValue: this.getRfaValueDistribution(projects),
    };
  }
}

// Export singleton instance
const reportDataService = new ReportDataService();
export default reportDataService;
