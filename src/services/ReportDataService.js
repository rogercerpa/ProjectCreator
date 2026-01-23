/**
 * Report Data Service
 * Aggregates project data for analytics reports
 * Supports custom date ranges and advanced filtering
 */

import {
  getMonthDateRange,
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
   * Get unique values for a field (for filter dropdowns)
   * @param {string} field - Field name
   * @returns {Array} Unique values sorted alphabetically
   */
  getUniqueValues(field) {
    const values = new Set();
    this.projects.forEach(project => {
      const value = project[field];
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => v && values.add(v));
        } else if (typeof value === 'string' && field === 'products') {
          value.split(',').forEach(v => v.trim() && values.add(v.trim()));
        } else {
          values.add(value);
        }
      }
    });
    return Array.from(values).sort();
  }

  /**
   * Get all available filter options from the data
   * @returns {object} Filter options for each field
   */
  getFilterOptions() {
    return {
      rfaTypes: this.getUniqueValues('rfaType'),
      regions: this.getUniqueValues('regionalTeam'),
      statuses: this.getUniqueValues('rfaStatus'),
      agencies: this.getUniqueValues('agencyName'),
      products: this.getUniqueValues('products'),
      designers: this.getUniqueValues('designBy'),
      qcMembers: this.getUniqueValues('qcBy'),
      triageMembers: this.getUniqueValues('triagedBy'),
    };
  }

  /**
   * Filter projects by custom date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} viewMode - 'created' or 'completed'
   * @returns {Array} Filtered projects
   */
  filterProjectsByDateRange(startDate, endDate, viewMode = 'created') {
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
   * Apply filters to projects array
   * @param {Array} projects - Projects to filter
   * @param {object} filters - Filter criteria
   * @returns {Array} Filtered projects
   */
  applyFilters(projects, filters = {}) {
    let filtered = [...projects];

    // Filter by RFA Types
    if (filters.rfaTypes && filters.rfaTypes.length > 0) {
      filtered = filtered.filter(p => filters.rfaTypes.includes(p.rfaType));
    }

    // Filter by Regions
    if (filters.regions && filters.regions.length > 0) {
      filtered = filtered.filter(p => filters.regions.includes(p.regionalTeam));
    }

    // Filter by Statuses
    if (filters.statuses && filters.statuses.length > 0) {
      filtered = filtered.filter(p => filters.statuses.includes(p.rfaStatus));
    }

    // Filter by Agencies
    if (filters.agencies && filters.agencies.length > 0) {
      filtered = filtered.filter(p => filters.agencies.includes(p.agencyName));
    }

    // Filter by Products (project has any of the selected products)
    if (filters.products && filters.products.length > 0) {
      filtered = filtered.filter(p => {
        const projectProducts = Array.isArray(p.products)
          ? p.products
          : (p.products || '').split(',').map(prod => prod.trim()).filter(Boolean);
        return filters.products.some(fp => projectProducts.includes(fp));
      });
    }

    // Filter by Designer
    if (filters.designer) {
      filtered = filtered.filter(p => p.designBy === filters.designer);
    }

    // Filter by QC
    if (filters.qc) {
      filtered = filtered.filter(p => p.qcBy === filters.qc);
    }

    // Filter by Triage
    if (filters.triage) {
      filtered = filtered.filter(p => p.triagedBy === filters.triage);
    }

    return filtered;
  }

  /**
   * Get previous period date range for comparison
   * @param {Date} startDate - Current period start
   * @param {Date} endDate - Current period end
   * @returns {object} Previous period dates
   */
  getPreviousPeriodDates(startDate, endDate) {
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - duration);
    return { startDate: prevStartDate, endDate: prevEndDate };
  }

  /**
   * Calculate KPIs for a date range with filters
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} viewMode - 'created' or 'completed'
   * @param {object} filters - Additional filters
   * @returns {object} KPI metrics
   */
  calculateKPIsWithFilters(startDate, endDate, viewMode = 'created', filters = {}) {
    // Get current period projects
    let currentProjects = this.filterProjectsByDateRange(startDate, endDate, viewMode);
    currentProjects = this.applyFilters(currentProjects, filters);

    // Get previous period projects for comparison
    const prevPeriod = this.getPreviousPeriodDates(startDate, endDate);
    let previousProjects = this.filterProjectsByDateRange(prevPeriod.startDate, prevPeriod.endDate, viewMode);
    previousProjects = this.applyFilters(previousProjects, filters);

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
        change: calculatePercentageChange(prevAvgTurnaroundTime, avgTurnaroundTime),
      },
      onTimeRate: {
        value: onTimeRate,
        change: calculatePercentageChange(onTimeRate, prevOnTimeRate),
      },
    };
  }

  /**
   * Get RFA Type distribution
   */
  getRfaTypeDistribution(projects) {
    return groupAndCount(projects, 'rfaType');
  }

  /**
   * Get Regional Team distribution
   */
  getRegionalDistribution(projects) {
    return groupAndCount(projects, 'regionalTeam');
  }

  /**
   * Get Status distribution
   */
  getStatusDistribution(projects) {
    return groupAndCount(projects, 'rfaStatus');
  }

  /**
   * Get top agencies by project count
   */
  getTopAgencies(projects, limit = 10) {
    return groupAndCount(projects, 'agencyName').slice(0, limit);
  }

  /**
   * Get weekly/daily project intake based on date range
   */
  getProjectIntake(projects, startDate, endDate) {
    const duration = endDate.getTime() - startDate.getTime();
    const days = duration / (1000 * 60 * 60 * 24);
    
    // If range is <= 31 days, show weekly
    if (days <= 31) {
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
    
    // For longer ranges, show monthly
    const months = {};
    projects.forEach(project => {
      const dateField = project.createdAt || project.submittedDate;
      if (dateField) {
        const date = new Date(dateField);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months[monthKey] = (months[monthKey] || 0) + 1;
      }
    });

    return Object.entries(months)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const dateA = new Date(a.name);
        const dateB = new Date(b.name);
        return dateA - dateB;
      });
  }

  /**
   * Get product mix
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
   * Generate complete report data with custom date range and filters
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} viewMode - 'created' or 'completed'
   * @param {object} filters - Filter criteria
   * @returns {object} Complete report data
   */
  generateReportWithFilters(startDate, endDate, viewMode = 'created', filters = {}) {
    // Get filtered projects
    let projects = this.filterProjectsByDateRange(startDate, endDate, viewMode);
    projects = this.applyFilters(projects, filters);

    // Calculate KPIs with comparison
    const kpis = this.calculateKPIsWithFilters(startDate, endDate, viewMode, filters);

    return {
      period: { startDate, endDate, viewMode },
      projectCount: projects.length,
      filteredProjects: projects, // Include for drill-down
      kpis,
      charts: {
        rfaTypeDistribution: this.getRfaTypeDistribution(projects),
        regionalDistribution: this.getRegionalDistribution(projects),
        statusDistribution: this.getStatusDistribution(projects),
        topAgencies: this.getTopAgencies(projects),
        projectIntake: this.getProjectIntake(projects, startDate, endDate),
        productMix: this.getProductMix(projects),
      },
      teamPerformance: this.getTeamPerformance(projects),
      dasRevenue: this.getDasRevenueBreakdown(projects),
      rfaValue: this.getRfaValueDistribution(projects),
    };
  }

  // Legacy method for backward compatibility
  generateReport(year, month, viewMode = 'created') {
    const { startDate, endDate } = getMonthDateRange(year, month);
    return this.generateReportWithFilters(startDate, endDate, viewMode, {});
  }
}

// Export singleton instance
const reportDataService = new ReportDataService();
export default reportDataService;
